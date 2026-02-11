from pydantic import BaseModel, computed_field

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


class BestTimeSlot(BaseModel):
    day_of_week: int
    hour_utc: int
    avg_engagement_rate: float
    avg_impressions: float
    sample_count: int

    @computed_field  # type: ignore[prop-decorator]
    @property
    def day_name(self) -> str:
        if 0 <= self.day_of_week <= 6:
            return DAY_NAMES[self.day_of_week]
        return "Unknown"

    model_config = {"from_attributes": True}


class BestTimesResponse(BaseModel):
    account_id: str
    platform: str
    best_times: list[BestTimeSlot]


class HeatmapCell(BaseModel):
    day_of_week: int
    hour_utc: int
    value: float  # engagement rate

    model_config = {"from_attributes": True}


class HeatmapResponse(BaseModel):
    account_id: str
    platform: str
    data: list[HeatmapCell]


class AnalyzeResponse(BaseModel):
    account_id: str
    platform: str
    slots_updated: int
    message: str
