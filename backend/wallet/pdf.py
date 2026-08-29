"""
Generates a simple one-page invoice PDF per WalletTopup using reportlab
(add to requirements.txt: reportlab>=4.0).
"""

import io

from django.core.files.base import ContentFile
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas


def generate_topup_invoice_pdf(topup):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    width, height = letter

    c.setFont("Helvetica-Bold", 18)
    c.drawString(1 * inch, height - 1 * inch, "cagent — Wallet Top-up Invoice")

    c.setFont("Helvetica", 10)
    y = height - 1.5 * inch
    lines = [
        f"Invoice #: {topup.invoice_number}",
        f"Date: {topup.paid_at.strftime('%Y-%m-%d %H:%M')}",
        f"Billed to: {topup.tenant.company_name}",
        "",
        f"Amount requested (USD): ${topup.usd_amount_requested}",
        f"FX rate applied: 1 USD = {topup.fx_rate_used} PKR",
        f"Base charge (PKR): Rs. {topup.pkr_base_amount}",
        f"Gateway processing fee (PKR): Rs. {topup.gateway_fee_pkr}",
        f"Total charged via Raast: Rs. {topup.total_charged_pkr}",
        "",
        f"cagent platform fee (USD): ${topup.platform_fee_usd}",
        f"Net credited to wallet: ${topup.net_credited_usd}",
        "",
        f"Payment reference: {topup.gateway_reference}",
        f"Order ID: {topup.gateway_order_id}",
    ]
    for line in lines:
        c.drawString(1 * inch, y, line)
        y -= 0.25 * inch

    c.showPage()
    c.save()
    buf.seek(0)

    topup.invoice_pdf.save(f"{topup.invoice_number}.pdf", ContentFile(buf.read()), save=True)