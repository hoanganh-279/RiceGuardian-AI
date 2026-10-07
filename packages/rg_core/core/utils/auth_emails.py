"""Auth email helpers for phone-only farmer accounts."""

PHONE_AUTH_DOMAIN = "phone.riceguardian.vn"


def digits_only(phone):
    return "".join(ch for ch in str(phone or "") if ch.isdigit())


def phone_auth_email(phone):
    digits = digits_only(phone)
    if not digits:
        raise ValueError("Số điện thoại không hợp lệ.")
    return f"{digits}@{PHONE_AUTH_DOMAIN}"


def is_phone_auth_email(email):
    return str(email or "").lower().endswith(f"@{PHONE_AUTH_DOMAIN}")
