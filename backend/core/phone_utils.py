import re


def normalize_to_e164(phone_number: str, default_country_code: str = "1") -> str:
    """
    Normalizes a US/Canada-style phone number into E.164 format.

    Strips all non-digit characters, then prefixes '+1' (or the given
    default country code) if not already present. This handles the common
    case of leads stored as '(512) 478-2500', '512-478-2500', or
    '5124782500' from manual entry, bulk upload, or scraped data that
    wasn't already normalized.

    This is the single source of truth for phone formatting — every model
    that stores a phone_number normalizes through this at save() time, and
    every lookup/query normalizes its input through this before comparing,
    so a number can never silently diverge into two different strings for
    the same real number again.
    """
    if not phone_number:
        return phone_number

    digits = re.sub(r"\D", "", phone_number)
    if not digits:
        return phone_number  # nothing we can do — let Telnyx/validation reject it with a clear error

    if len(digits) == 10:
        digits = default_country_code + digits

    return f"+{digits}"