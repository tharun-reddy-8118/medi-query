from pydantic import BaseModel


from typing import Any

class QuestionRequest(BaseModel):
    question: str
    file_id: str
    history: list[dict[str, Any]] = []


class ForecastRequest(BaseModel):
    file_id: str
    date_col: str | None = None

class DataRequest(BaseModel):
    file_id: str
    limit: int = 1000
    date_column: str | None = None
    dateCol: str | None = None
    value_col: str | None = None
    value_column: str | None = None
    valueCol: str | None = None
    target_col: str | None = None
    metric: str | None = None
    periods: int = 30
    days: int | None = None
    freq: str = "D"
    frequency: str | None = None

    def resolved_date_col(self):
        return self.date_col or self.date_column or self.dateCol

    def resolved_value_col(self):
        return self.value_col or self.value_column or self.valueCol or self.target_col or self.metric

    def resolved_periods(self):
        return self.days or self.periods

    def resolved_freq(self):
        return self.frequency or self.freq

class BuildChartRequest(BaseModel):
    file_id: str
    dimension: str = ""
    measure: str = ""
    agg: str = "SUM"
    chart_type: str = "bar"
    prompt: str | None = None
    filters: dict[str, Any] | None = None
    group_by: str | None = None
    time_grouping: str = "none"
    limit: int | None = None
    parameters: dict[str, Any] | None = None
    advanced_filters: list[dict[str, Any]] | None = None
    label_col: str | None = None
    label_agg: str | None = None
    extra_cols: list[str] | None = None
    map_region: str | None = None
    gauge_target: float | None = None

class AdminCreateUserRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str

class BuildKpiRequest(BaseModel):
    file_id: str
    measure: str = ""
    label: str = ""
    agg: str = "ALL"  # ALL | SUM | AVG | COUNT | COUNT_DISTINCT | MIN | MAX
    prompt: str | None = None
    filters: dict[str, Any] | None = None
    parameters: dict[str, Any] | None = None
    advanced_filters: list[dict[str, Any]] | None = None

class DashboardConfigRequest(BaseModel):
    config: dict[str, Any]

class RenameRequest(BaseModel):
    filename: str

class CreateCalculatedFieldRequest(BaseModel):
    file_id: str
    col_name: str
    expression: str

class JoinDatasetsRequest(BaseModel):
    file_id_1: str
    file_id_2: str
    join_key_1: str
    join_key_2: str
    join_type: str = 'LEFT'
    alias: str = ''


class ExportRequest(BaseModel):
    ui_config: dict
