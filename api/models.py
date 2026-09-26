from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

Source = Literal["fb_marketplace", "craigslist", "carmax", "dealer", "synthetic"]
TitleStatus = Literal["clean", "salvage", "rebuilt", "lien", "unknown"]
Urgency = Literal["asap", "this_week", "this_month", "flexible"]
TeslaModel = Literal["3", "Y", "S", "X", "Cybertruck"]
AutopilotPackage = Literal["none", "AP", "EAP", "FSD"]


class Location(BaseModel):
    city: str
    zip: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class Seller(BaseModel):
    type: Literal["private", "dealer"]
    name: Optional[str] = None
    contact: Optional[str] = None  # never returned in public responses


class HistoryReport(BaseModel):
    provider: Literal["carmax", "carfax", "autocheck", "other"]
    url: Optional[str] = None
    summary: Optional[str] = None


class CarListing(BaseModel):
    id: str
    vin: Optional[str] = None
    make: Literal["Tesla"] = "Tesla"
    model: TeslaModel
    year: int
    trim: Optional[str] = None
    mileage: int
    price: int
    photos: list[str] = Field(default_factory=list)
    accident_history: Optional[str] = None
    maintenance_history: Optional[str] = None
    history_report: Optional[HistoryReport] = None
    location: Location
    seller: Seller
    source: Source
    listing_url: str
    listed_at: datetime
    title_status: TitleStatus = "unknown"
    how_soon: Optional[str] = None
    # Tesla-specific, all optional
    battery_range_mi: Optional[int] = None
    autopilot_package: Optional[AutopilotPackage] = None
    color: Optional[str] = None
    charging_included: Optional[bool] = None
    battery_health_pct: Optional[float] = None


class SearchLocation(BaseModel):
    city: Literal["San Francisco"] = "San Francisco"
    zip: Optional[str] = None
    sf_only: bool = True  # restrict to 941xx zips


class PromptPackage(BaseModel):
    make: Literal["Tesla"] = "Tesla"
    models: list[TeslaModel] = Field(default_factory=list)  # empty = any
    budget_max_usd: Optional[int] = None
    autopilot_min: Optional[AutopilotPackage] = None
    min_range_mi: Optional[int] = None
    must_haves: list[str] = Field(default_factory=list)
    nice_to_haves: list[str] = Field(default_factory=list)
    urgency: Urgency = "flexible"
    location: SearchLocation = Field(default_factory=SearchLocation)
    year_min: Optional[int] = None
    mileage_max: Optional[int] = None


class StageCounts(BaseModel):
    total: int
    after_sql: int
    scored: int
    top_n: int


class RankedResult(BaseModel):
    rank: int
    score: float
    reasons: list[str]
    listing: CarListing


class SearchRequest(BaseModel):
    text: str
    channel: Literal["api", "imessage"] = "api"
    top_n: int = 5
    session_id: Optional[str] = None


class SearchResponse(BaseModel):
    session_id: str
    package: PromptPackage
    counts: StageCounts
    cost: dict
    results: list[RankedResult]


class ClarifyRequest(BaseModel):
    text: str


class ClarifyResponse(BaseModel):
    package: PromptPackage
    questions: list[str] = Field(default_factory=list)


class SelectRequest(BaseModel):
    listing_ids: list[str] = Field(min_length=1, max_length=3)


class NegotiateRequest(BaseModel):
    session_id: str
    listing_id: str
    target_price_usd: int
    walk_away_usd: int
    mode: Literal["simulated", "live"] = "simulated"


class IngestRequest(BaseModel):
    source: Source
    items: list[CarListing]


class PhotonInbound(BaseModel):
    from_: str = Field(alias="from")
    text: str
    message_id: Optional[str] = None
