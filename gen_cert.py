"""
Genera un certificado SSL autofirmado (ssl/cert.pem + ssl/key.pem) sin depender
de OpenSSL. Usa la librería 'cryptography', por lo que funciona igual en
Windows y Linux. Incluye las IPs locales en el SAN para el acceso por red.

Uso:  python gen_cert.py
"""
import datetime
import ipaddress
import socket
from pathlib import Path

from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

SSL_DIR = Path(__file__).parent / "ssl"
CERT = SSL_DIR / "cert.pem"
KEY = SSL_DIR / "key.pem"


def ips_locales():
    ips = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except socket.gaierror:
        pass
    ips.discard("127.0.0.1")
    return sorted(ips)


def main():
    SSL_DIR.mkdir(exist_ok=True)
    if CERT.exists() and KEY.exists():
        print(f"Ya existe un certificado en {SSL_DIR} (se conserva).")
        return

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    san = [x509.DNSName("localhost"), x509.IPAddress(ipaddress.IPv4Address("127.0.0.1"))]
    for ip in ips_locales():
        try:
            san.append(x509.IPAddress(ipaddress.IPv4Address(ip)))
        except ipaddress.AddressValueError:
            pass

    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "VEF")])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=3650))
        .add_extension(x509.SubjectAlternativeName(san), critical=False)
        .sign(key, hashes.SHA256())
    )

    KEY.write_bytes(
        key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
    )
    CERT.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    print(f"Certificado autofirmado generado en {SSL_DIR} (válido 10 años).")


if __name__ == "__main__":
    main()
