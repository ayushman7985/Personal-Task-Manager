from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

Priority = Literal["low", "medium", "high"]


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Priority = "medium"


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[Priority] = None


class TaskResponse(TaskBase):
    id: int
    completed: bool
    position: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskReorder(BaseModel):
    task_ids: list[int] = Field(..., min_length=1)


class TaskCounts(BaseModel):
    active: int
    completed: int
