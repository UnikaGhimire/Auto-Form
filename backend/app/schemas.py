from pydantic import BaseModel, Field, HttpUrl
from typing import Optional

class ProfileIn(BaseModel):
    full_name: str=''; email: str=''; phone: str=''; location: str=''; date_of_birth: str=''; linkedin: str=''; github: str=''; portfolio: str=''
class EducationIn(BaseModel):
    institution: str=Field(min_length=1,max_length=300); degree:str=''; field:str=''; start_date:str=''; end_date:str=''; grade:str=''; description:str=''
class ExperienceIn(BaseModel):
    company:str=Field(min_length=1,max_length=300); position:str=''; start_date:str=''; end_date:str=''; description:str=''
class SkillIn(BaseModel): name:str=Field(min_length=1,max_length=200)
class ProjectIn(BaseModel): name:str=Field(min_length=1,max_length=300); description:str=''; technologies:str=''; role:str=''; url:str=''
class FieldIn(BaseModel):
    id:str=Field(max_length=200); tag:str='input'; type:str='text'; name:str=''; id_attribute:str=''; label:str=''; placeholder:str=''; aria_label:str=''; nearby_text:str=''; required:bool=False; options:list[str]=[]
class ClassifyRequest(BaseModel): fields:list[FieldIn]=Field(max_length=200)
class AnswerIn(BaseModel): question:str=Field(min_length=3,max_length=3000); answer:str=Field(min_length=1,max_length=10000)
class GenerateRequest(BaseModel): question:str=Field(min_length=3,max_length=3000)
class ConfirmDelete(BaseModel): confirm: bool=False
