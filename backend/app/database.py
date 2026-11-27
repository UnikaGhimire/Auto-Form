from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker, with_loader_criteria
from .config import settings


class Base(DeclarativeBase): pass


if settings.is_sqlite:
    engine = create_engine(settings.database_url, connect_args={'check_same_thread': False})
else:
    # pool_pre_ping survives free-tier Postgres servers that drop idle connections.
    engine = create_engine(settings.database_url, pool_pre_ping=True, pool_size=5, max_overflow=5, pool_recycle=300)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


# --------------------------------------------------------------------------------------
# Multi-user isolation
# --------------------------------------------------------------------------------------
# Every request authenticates a user and stores its id in `session.info['user_id']`.
# Every SELECT issued through that session is then automatically restricted to the
# user's own rows, and every new row is stamped with the user's id. Endpoint code also
# filters explicitly; this is the safety net that keeps a forgotten filter from leaking
# another person's profile.

def _tenant_mixin():
    from .models import TenantMixin
    return TenantMixin


@event.listens_for(Session, 'do_orm_execute')
def _restrict_to_user(state):
    user_id = state.session.info.get('user_id')
    if user_id is None or state.is_column_load or state.is_relationship_load:
        return
    if state.is_select or state.is_update or state.is_delete:
        state.statement = state.statement.options(
            with_loader_criteria(_tenant_mixin(), lambda cls: cls.user_id == user_id, include_aliases=True))


@event.listens_for(Session, 'before_flush')
def _stamp_user(session, _context, _instances):
    user_id = session.info.get('user_id')
    if user_id is None:
        return
    mixin = _tenant_mixin()
    for obj in session.new:
        if isinstance(obj, mixin) and not obj.user_id:
            obj.user_id = user_id
    for obj in session.dirty:
        if isinstance(obj, mixin) and obj.user_id != user_id:
            raise PermissionError('Attempted to modify another user\'s record.')


def add_missing_columns():
    """Add columns introduced after a database file was first created."""
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as connection:
        for table in Base.metadata.sorted_tables:
            if table.name not in existing_tables: continue
            present = {column['name'] for column in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in present: continue
                ddl_type = column.type.compile(dialect=engine.dialect)
                default = column.server_default.arg.text if column.server_default is not None and hasattr(column.server_default.arg, 'text') else None
                suffix = f" DEFAULT {default}" if default else (" DEFAULT ''" if ddl_type.upper().startswith(('VARCHAR', 'TEXT')) else '')
                connection.execute(text(f'ALTER TABLE {table.name} ADD COLUMN "{column.name}" {ddl_type}{suffix}'))


def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()
