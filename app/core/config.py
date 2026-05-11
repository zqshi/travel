from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    anthropic_base_url: str = ""
    anthropic_model: str = ""
    tavily_api_key: str = ""
    klook_affiliate_id: str = ""
    kkday_affiliate_id: str = ""
    agoda_affiliate_id: str = ""
    supabase_url: str = ""
    supabase_key: str = ""
    jwt_secret: str = "dev-secret-change-in-production"

    # Omise支付
    omise_public_key: str = ""
    omise_secret_key: str = ""

    # Twilio语音
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    # App
    app_base_url: str = "http://localhost:8000"

    @property
    def llm_model(self) -> str:
        return self.anthropic_model or "mco-4"

    @property
    def llm_model_light(self) -> str:
        return self.anthropic_model or "mco-4"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
