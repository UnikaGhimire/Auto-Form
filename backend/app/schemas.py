from pydantic import BaseModel, Field, HttpUrl
from typing import Literal, Optional

class ProfileIn(BaseModel):
    full_name: str=''; email: str=''; phone: str=''; location: str=''; address: str=''; date_of_birth: str=''; linkedin: str=''; github: str=''; portfolio: str=''; headline: str=''; summary: str=''; languages: str=''; current_company: str=''; graduation_year: str=''; work_authorization: str=''; visa_status: str=''; availability: str=''; notice_period: str=''; salary_expectation: str=''; references: str=''; certifications: str=''; awards: str=''; interests: str=''
class ProfileOut(ProfileIn):
    id: int=1
class EducationIn(BaseModel):
    institution: str=Field(min_length=1,max_length=300); degree:str=''; field:str=''; start_date:str=''; end_date:str=''; grade:str=''; description:str=''
class ExperienceIn(BaseModel):
    company:str=Field(min_length=1,max_length=300); position:str=''; start_date:str=''; end_date:str=''; description:str=''
class SkillIn(BaseModel): name:str=Field(min_length=1,max_length=200)
class ProjectIn(BaseModel): name:str=Field(min_length=1,max_length=300); description:str=''; technologies:str=''; role:str=''; url:str=''
class FieldIn(BaseModel):
    id:str=Field(max_length=200); tag:str='input'; type:str='text'; name:str=''; id_attribute:str=''; label:str=''; placeholder:str=''; aria_label:str=''; nearby_text:str=''; required:bool=False; options:list[str]=[]
    section:str=''; question_hint:str=''; question:str=''; autocomplete:str=''; option_values:list[str]=[]; current_value:str=''; visible:bool=True
class ClassifyRequest(BaseModel): fields:list[FieldIn]
class AnswerIn(BaseModel): question:str=Field(min_length=3,max_length=3000); answer:str=Field(min_length=1,max_length=10000)
class GenerateRequest(BaseModel): question:str=Field(min_length=3,max_length=3000); length:Literal['concise','standard','detailed']='standard'
class SaveAnswerRequest(BaseModel): question:str=Field(min_length=3,max_length=3000); answer:str=Field(min_length=1,max_length=10000)
class ConfirmDelete(BaseModel): confirm: bool=False
