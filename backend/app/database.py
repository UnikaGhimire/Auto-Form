from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .config import settings

class Base(DeclarativeBase): pass
engine = create_engine(settings.database_url, connect_args={'check_same_thread': False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

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
