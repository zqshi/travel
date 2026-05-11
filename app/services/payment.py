from __future__ import annotations

import logging
from dataclasses import dataclass

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class ChargeResult:
    success: bool
    charge_id: str = ""
    status: str = ""
    failure_code: str = ""
    failure_message: str = ""
    authorize_uri: str = ""


class PaymentService:
    """Omise支付网关封装（泰国本地网关，支持PromptPay/信用卡/TrueMoney）"""

    def __init__(self):
        settings = get_settings()
        self.secret_key = settings.omise_secret_key
        self.public_key = settings.omise_public_key

    async def create_charge(
        self,
        amount_thb: float,
        token: str,
        description: str = "",
        metadata: dict | None = None,
    ) -> ChargeResult:
        """创建支付charge（金额单位：satang = THB * 100）"""
        import omise

        omise.api_secret = self.secret_key
        amount_satang = int(amount_thb * 100)

        try:
            charge = omise.Charge.create(
                amount=amount_satang,
                currency="THB",
                card=token,
                description=description or "Travel Agent Booking",
                metadata=metadata or {},
            )

            if charge.status == "successful":
                return ChargeResult(
                    success=True,
                    charge_id=charge.id,
                    status="successful",
                )
            elif charge.status == "pending" and charge.authorize_uri:
                return ChargeResult(
                    success=False,
                    charge_id=charge.id,
                    status="pending",
                    authorize_uri=charge.authorize_uri,
                )
            else:
                return ChargeResult(
                    success=False,
                    charge_id=charge.id,
                    status=charge.status,
                    failure_code=charge.failure_code or "",
                    failure_message=charge.failure_message or "",
                )
        except omise.errors.BaseError as e:
            logger.error(f"Omise charge failed: {e}")
            return ChargeResult(
                success=False,
                failure_code="omise_error",
                failure_message=str(e),
            )

    async def get_charge(self, charge_id: str) -> dict:
        """查询charge状态"""
        import omise

        omise.api_secret = self.secret_key
        try:
            charge = omise.Charge.retrieve(charge_id)
            return {
                "id": charge.id,
                "status": charge.status,
                "amount": charge.amount,
                "currency": charge.currency,
                "paid": charge.paid,
                "failure_code": charge.failure_code,
            }
        except Exception as e:
            logger.error(f"Get charge failed: {e}")
            return {"error": str(e)}

    async def create_refund(self, charge_id: str, amount_thb: float | None = None) -> dict:
        """退款（不传amount则全额退款）"""
        import omise

        omise.api_secret = self.secret_key
        try:
            charge = omise.Charge.retrieve(charge_id)
            params = {}
            if amount_thb:
                params["amount"] = int(amount_thb * 100)
            refund = charge.refunds.create(**params)
            return {
                "id": refund.id,
                "amount": refund.amount,
                "status": "success",
            }
        except Exception as e:
            logger.error(f"Refund failed: {e}")
            return {"error": str(e)}
