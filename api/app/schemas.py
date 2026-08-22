from datetime import date

from pydantic import BaseModel, Field, field_validator, model_validator


class CreateOrgRequest(BaseModel):
    org_name: str
    admin_name: str


class UpdateOrgRequest(BaseModel):
    name: str = Field(min_length=1)


class AddMemberRequest(BaseModel):
    name: str
    email: str


class UpdateMemberRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    access_level: str | None = None  # 'full' | 'view_only'
    role: str | None = None  # 'admin' | 'member' — promote/demote


class LinkPendingMemberResponse(BaseModel):
    org_id: str | None
    linked: bool


class ChandaCreate(BaseModel):
    donor_name: str
    donor_mobile: str | None = None
    amount: float = 0
    collected_on: date
    area: str | None = None
    book_reference: str | None = None
    item_description: str | None = None
    client_ref: str | None = None  # offline-generated id, echoed back for outbox reconciliation

    @field_validator("amount")
    @classmethod
    def round_amount(cls, v: float) -> float:
        if v < 0:
            raise ValueError("amount cannot be negative")
        return round(v, 2)

    @model_validator(mode="after")
    def require_amount_or_item(self):
        if not self.item_description and self.amount <= 0:
            raise ValueError("amount must be greater than 0 for a cash entry")
        return self


class ChandaBatchCreate(BaseModel):
    entries: list[ChandaCreate]


class ChandaCommentCreate(BaseModel):
    comment: str = Field(min_length=1)


class ChandaAdjustCreate(BaseModel):
    amount: float
    note: str = Field(min_length=1)
    donor_name: str | None = None
    donor_mobile: str | None = None
    collected_on: date | None = None
    area: str | None = None
    book_reference: str | None = None

    @field_validator("amount")
    @classmethod
    def nonzero_rounded(cls, v: float) -> float:
        if v == 0:
            raise ValueError("amount cannot be zero")
        return round(v, 2)


class PledgeCreate(BaseModel):
    donor_name: str
    donor_mobile: str | None = None
    item_description: str | None = None  # null = cash promised for later, no item involved
    promised_on: date | None = None


class PledgeResolveCollected(BaseModel):
    value: float | None = None
    collected_on: date | None = None

    @field_validator("value")
    @classmethod
    def round_value(cls, v: float | None) -> float | None:
        if v is None:
            return None
        if v < 0:
            raise ValueError("value cannot be negative")
        return round(v, 2)


class PledgeResolveCash(BaseModel):
    amount: float = Field(gt=0)
    collected_on: date | None = None

    @field_validator("amount")
    @classmethod
    def round_amount(cls, v: float) -> float:
        return round(v, 2)


class ExpenseCommentCreate(BaseModel):
    comment: str = Field(min_length=1)


class ExpenseAdjustCreate(BaseModel):
    amount: float
    note: str = Field(min_length=1)
    category: str | None = None
    vendor_name: str | None = None
    expense_date: date | None = None

    @field_validator("amount")
    @classmethod
    def nonzero_rounded(cls, v: float) -> float:
        if v == 0:
            raise ValueError("amount cannot be zero")
        return round(v, 2)
