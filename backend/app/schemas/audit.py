from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AuditLogEntry(BaseModel):
    id: int
    action: str
    entity: str
    entity_id: Optional[str] = None
    result: str
    metadata: Optional[dict] = None
    created_at: datetime
    actor_name: str
    actor_email: Optional[str] = None


class AuditPagination(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class AuditFilters(BaseModel):
    actions: list[str]
    entities: list[str]


class AuditLogListResponse(BaseModel):
    items: list[AuditLogEntry]
    filters: AuditFilters
    pagination: AuditPagination
    retention_days: int
    note: str
