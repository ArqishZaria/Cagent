"""
Gateway-agnostic interface so wallet.services doesn't care whether you end
up on PayFast or Safepay — swap the implementation in settings.py
(WALLET_GATEWAY_CLASS) without touching anything else.
"""

from abc import ABC, abstractmethod


class RaastGateway(ABC):
    @abstractmethod
    def create_dynamic_qr(self, *, order_id: str, amount_pkr, description: str) -> dict:
        """
        Returns {"qr_payload": str, "gateway_reference": str, "expires_at": datetime}.
        """

    @abstractmethod
    def verify_webhook(self, request) -> dict:
        """
        Verifies the incoming webhook's signature and returns the parsed
        payload dict. Raises PermissionDenied on failure. Payload must
        include at least: order_id, status, gateway_reference.
        """