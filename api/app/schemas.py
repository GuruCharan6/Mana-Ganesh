from datetime import date

from pydantic import BaseModel, Field, field_validator, model_validator


class CreateOrgRequest(BaseModel):
    org_name: str
    admin_name: str


class UpdateOrgRequest(BaseModel):
    name: str | None = None
    lucky_draw_ticket_price: float | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("name cannot be blank")
        return v

    @field_validator("lucky_draw_ticket_price")
    @classmethod
    def price_positive(cls, v: float | None) -> float | None:
        if v is not None and v <= 0:
            raise ValueError("ticket price must be positive")
        return round(v, 2) if v is not None else v


class AddMemberRequest(BaseModel):
    name: str
    email: str
    mobile_number: str = Field(min_length=1)


class UpdateMemberRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    mobile_number: str | None = None
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
    payment_method: str | None = None  # 'cash' | 'qr'
    client_ref: str | None = None  # offline-generated id, echoed back for outbox reconciliation

    @field_validator("amount")
    @classmethod
    def round_amount(cls, v: float) -> float:
        if v < 0:
            raise ValueError("amount cannot be negative")
        return round(v, 2)

    @field_validator("payment_method")
    @classmethod
    def valid_payment_method(cls, v: str | None) -> str | None:
        if v is not None and v not in ("cash", "qr"):
            raise ValueError("payment_method must be 'cash' or 'qr'")
        return v

    @model_validator(mode="after")
    def require_amount_or_item(self):
        if not self.item_description and self.amount <= 0:
            raise ValueError("amount must be greater than 0 for a cash entry")
        return self


class ChandaBatchCreate(BaseModel):
    entries: list[ChandaCreate]


class ChandaUpdate(BaseModel):
    donor_name: str | None = None
    donor_mobile: str | None = None
    amount: float | None = None
    collected_on: date | None = None
    area: str | None = None
    book_reference: str | None = None
    item_description: str | None = None
    payment_method: str | None = None

    @field_validator("amount")
    @classmethod
    def round_amount(cls, v: float | None) -> float | None:
        if v is None:
            return None
        if v < 0:
            raise ValueError("amount cannot be negative")
        return round(v, 2)


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
    area: str | None = None
    book_reference: str | None = None
    promised_amount: float | None = None  # informational only; resolving asks for the actual value


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


class ExpenseUpdate(BaseModel):
    category: str | None = None
    vendor_name: str | None = None
    amount: float | None = None
    expense_date: date | None = None

    @field_validator("amount")
    @classmethod
    def positive_rounded(cls, v: float | None) -> float | None:
        if v is None:
            return None
        if v <= 0:
            raise ValueError("amount must be positive")
        return round(v, 2)


class LuckyDrawTicket(BaseModel):
    buyer_name: str = Field(min_length=1)
    buyer_mobile: str | None = None
    buyer_address: str | None = None


class LuckyDrawCreate(BaseModel):
    payment_method: str
    tickets: list[LuckyDrawTicket] = Field(min_length=1)

    @field_validator("payment_method")
    @classmethod
    def valid_payment_method(cls, v: str) -> str:
        if v not in ("cash", "qr"):
            raise ValueError("payment_method must be 'cash' or 'qr'")
        return v


class LuckyDrawUpdate(BaseModel):
    buyer_name: str | None = None
    buyer_mobile: str | None = None
    buyer_address: str | None = None
    amount: float | None = None
    payment_method: str | None = None

    @field_validator("amount")
    @classmethod
    def positive_rounded(cls, v: float | None) -> float | None:
        if v is None:
            return None
        if v <= 0:
            raise ValueError("amount must be positive")
        return round(v, 2)

    @field_validator("payment_method")
    @classmethod
    def valid_payment_method(cls, v: str | None) -> str | None:
        if v is not None and v not in ("cash", "qr"):
            raise ValueError("payment_method must be 'cash' or 'qr'")
        return v
