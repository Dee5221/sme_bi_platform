"""
Pydantic schemas for the F11 Decision Support & Recommendations API.
"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class AffectedEntity(BaseModel):
    type: str
    id: Optional[int] = None
    name: Optional[str] = None
    sku: Optional[str] = None


class DataQuality(BaseModel):
    months_of_history: Optional[int] = None
    has_sufficient_data: bool
    limitations: str


class Recommendation(BaseModel):
    id: str
    category: str
    type: str
    severity: str
    title: str
    explanation: str
    suggested_action: str
    priority: int
    affected_entity: AffectedEntity
    metrics: Dict[str, Any]
    data_quality: DataQuality
    period: Optional[str] = None
    reason: Optional[str] = None
    audience: Optional[str] = None


class AnalysisPeriod(BaseModel):
    start: str
    end: str
    months: int


class RecommendationSummary(BaseModel):
    by_severity: Dict[str, int]
    by_category: Dict[str, int]


class RecommendationsResponse(BaseModel):
    generated_at: str
    analysis_period: AnalysisPeriod
    total_recommendations: int
    recommendations: List[Recommendation]
    summary: RecommendationSummary
    limitations: List[str]