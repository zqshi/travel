from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    anthropic_base_url: str = ""
    anthropic_model: str = ""
    anthropic_model_light: str = ""
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

    # App URLs
    app_base_url: str = "http://localhost:8000"
    frontend_base_url: str = "http://localhost:3000"

    # CORS — 逗号分隔的允许源列表
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Rate limiting
    rate_limit_send_interval: int = 60
    rate_limit_daily_send: int = 10
    rate_limit_verify_failures: int = 5
    rate_limit_verify_lock: int = 1800
    rate_limit_ip_per_minute: int = 30

    # WeChat OAuth
    wechat_app_id: str = ""
    wechat_app_secret: str = ""
    wechat_mp_app_id: str = ""
    wechat_mp_app_secret: str = ""

    @property
    def llm_model(self) -> str:
        return self.anthropic_model or "claude-sonnet-4-20250514"

    @property
    def llm_model_light(self) -> str:
        return self.anthropic_model_light or "claude-haiku-4-20250414"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
