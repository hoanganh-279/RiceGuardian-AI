import html
import os
import smtplib
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from flask import current_app


class MailError(Exception):
    def __init__(self, message, status=503):
        super().__init__(message)
        self.message = message
        self.status = status


def smtp_configured():
    return bool(current_app.config.get("SMTP_USER") and current_app.config.get("SMTP_PASSWORD"))


def logo_path():
    here = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.abspath(os.path.join(here, "..", "..", "..", "site", "src", "assets", "logo_riceguardianai.png")),
        os.path.abspath(os.path.join(here, "..", "..", "..", "site", "public", "favicon.png")),
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path
    return None


def send_mail(*, to, subject, body, reply_to=None, html_body=None, inline_logo=False):
    if not smtp_configured():
        raise MailError("Chưa cấu hình SMTP_USER / SMTP_PASSWORD.")

    sender = current_app.config["SMTP_USER"]
    logo = logo_path() if inline_logo else None
    use_html = bool(html_body)

    if use_html or logo:
        message = MIMEMultipart("related")
        message["Subject"] = subject
        message["From"] = f"RiceGuardian AI <{sender}>"
        message["To"] = to
        if reply_to:
            message["Reply-To"] = reply_to

        alternative = MIMEMultipart("alternative")
        alternative.attach(MIMEText(body, "plain", "utf-8"))
        if html_body:
            alternative.attach(MIMEText(html_body, "html", "utf-8"))
        message.attach(alternative)

        if logo:
            with open(logo, "rb") as handle:
                image = MIMEImage(handle.read(), _subtype="png")
            image.add_header("Content-ID", "<rg-logo>")
            image.add_header("Content-Disposition", "inline", filename="riceguardian-logo.png")
            message.attach(image)
    else:
        message = MIMEText(body, "plain", "utf-8")
        message["Subject"] = subject
        message["From"] = f"RiceGuardian AI <{sender}>"
        message["To"] = to
        if reply_to:
            message["Reply-To"] = reply_to

    host = current_app.config.get("SMTP_HOST") or "smtp.gmail.com"
    port = int(current_app.config.get("SMTP_PORT") or 587)
    try:
        with smtplib.SMTP(host, port, timeout=20) as smtp:
            smtp.starttls()
            smtp.login(sender, current_app.config["SMTP_PASSWORD"])
            smtp.send_message(message)
    except smtplib.SMTPAuthenticationError as err:
        raise MailError("Gmail từ chối đăng nhập. Kiểm tra App Password.") from err
    except OSError as err:
        raise MailError("Không gửi được email. Thử lại sau.") from err


def verification_email(*, name, code, minutes):
    safe_name = html.escape(name or "bạn")
    spaced = " ".join(code)
    plain = (
        f"Xin chào {name},\n\n"
        f"Mã xác nhận đăng nhập website RiceGuardian AI: {code}\n"
        f"Mã có hiệu lực {minutes} phút. Không chia sẻ mã này.\n"
    )
    logo_img = (
        '<img src="cid:rg-logo" width="56" height="56" alt="RiceGuardian AI" '
        'style="display:block;border:0;outline:none;width:56px;height:56px;" />'
        if logo_path()
        else ""
    )
    html_body = f"""\
<!DOCTYPE html>
<html lang="vi">
  <body style="margin:0;padding:0;background:#f4f7f4;font-family:Arial,Helvetica,sans-serif;color:#1a2e1c;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f4;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #d5e3d6;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#1b5e20;padding:22px 28px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:14px;">{logo_img}</td>
                    <td style="vertical-align:middle;">
                      <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.04em;">RICEGUARDIAN AI</div>
                      <div style="color:#c8e6c9;font-size:12px;margin-top:4px;">Xác nhận đăng nhập website</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px;">
                <p style="margin:0 0 8px;font-size:16px;">Xin chào <strong>{safe_name}</strong>,</p>
                <p style="margin:0;color:#5a6b5c;font-size:14px;line-height:1.6;">
                  Dùng mã dưới đây để hoàn tất đăng nhập lần đầu. Mã chỉ dùng một lần và hết hạn sau {minutes} phút.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 28px 8px;">
                <div style="display:inline-block;background:#e8f5e9;border:1px solid #c8e6c9;border-radius:12px;padding:16px 22px;">
                  <div style="color:#2e7d32;font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">Mã xác nhận</div>
                  <div style="margin-top:8px;color:#1b5e20;font-size:32px;font-weight:700;letter-spacing:0.28em;font-family:Consolas,Menlo,monospace;">{html.escape(spaced)}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 28px;">
                <p style="margin:0;color:#5a6b5c;font-size:13px;line-height:1.6;">
                  Nếu bạn không yêu cầu mã này, hãy bỏ qua email. Không chia sẻ mã với bất kỳ ai.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#f7faf6;border-top:1px solid #d5e3d6;padding:14px 28px;color:#5a6b5c;font-size:12px;">
                RiceGuardian AI · Trường Đại học Thủ Dầu Một
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""
    return plain, html_body


def _field_row(label, value):
    safe = html.escape(value or "—")
    return f"""\
<tr>
  <td style="padding:10px 0;border-bottom:1px solid #e8f0e9;width:34%;color:#5a6b5c;font-size:13px;vertical-align:top;">{html.escape(label)}</td>
  <td style="padding:10px 0;border-bottom:1px solid #e8f0e9;color:#1a2e1c;font-size:14px;font-weight:600;">{safe}</td>
</tr>"""


def contact_inbox_email(*, name, email, role, phone, org, message):
    display_name = name or "Khách"
    role_text = (role or "").strip() or "Không ghi"
    phone_text = (phone or "").strip() or "Không ghi"
    org_text = (org or "").strip() or "Không ghi"
    message_text = (message or "").strip()
    safe_email = html.escape(email or "")
    mailto = html.escape(f"mailto:{email}", quote=True)

    plain = "\n".join(
        [
            "Có câu hỏi mới từ website giới thiệu RiceGuardian AI.",
            "",
            f"Gmail khách (bấm Trả lời để gửi về hộp thư này): {email}",
            f"Họ tên: {display_name}",
            f"Chức vụ: {role_text}",
            f"Điện thoại: {phone_text}",
            f"Đơn vị: {org_text}",
            "",
            message_text,
        ]
    )
    logo_img = (
        '<img src="cid:rg-logo" width="56" height="56" alt="RiceGuardian AI" '
        'style="display:block;border:0;outline:none;width:56px;height:56px;" />'
        if logo_path()
        else ""
    )
    message_html = html.escape(message_text).replace("\n", "<br>")
    html_body = f"""\
<!DOCTYPE html>
<html lang="vi">
  <body style="margin:0;padding:0;background:#f4f7f4;font-family:Arial,Helvetica,sans-serif;color:#1a2e1c;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f4;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #d5e3d6;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#1b5e20;padding:22px 28px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:14px;">{logo_img}</td>
                    <td style="vertical-align:middle;">
                      <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.04em;">RICEGUARDIAN AI</div>
                      <div style="color:#c8e6c9;font-size:12px;margin-top:4px;">Phản hồi mới từ website giới thiệu</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 8px;">
                <p style="margin:0 0 6px;font-size:16px;font-weight:700;">Có câu hỏi mới từ khách hàng</p>
                <p style="margin:0;color:#5a6b5c;font-size:14px;line-height:1.6;">
                  Bấm Trả lời để gửi về Gmail khách. Không cần chuyển tiếp thủ công.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 4px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  {_field_row("Họ tên", display_name)}
                  {_field_row("Gmail khách", email)}
                  {_field_row("Chức vụ", role_text)}
                  {_field_row("Điện thoại", phone_text)}
                  {_field_row("Đơn vị", org_text)}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 8px;">
                <div style="color:#2e7d32;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Nội dung</div>
                <div style="margin-top:8px;background:#f7faf6;border:1px solid #d5e3d6;border-radius:12px;padding:14px 16px;font-size:15px;line-height:1.65;">{message_html}</div>
              </td>
            </tr>
            <tr>
              <td align="left" style="padding:8px 28px 24px;">
                <a href="{mailto}" style="display:inline-block;background:#2e7d32;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:999px;padding:12px 18px;">Trả lời {html.escape(display_name)}</a>
              </td>
            </tr>
            <tr>
              <td style="background:#f7faf6;border-top:1px solid #d5e3d6;padding:14px 28px;color:#5a6b5c;font-size:12px;">
                RiceGuardian AI · {safe_email}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""
    return plain, html_body
