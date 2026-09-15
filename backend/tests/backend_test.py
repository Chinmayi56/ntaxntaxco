"""NTAXCO ERP Backend Auth Tests"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture
def s():
    return requests.Session()


# ---- health ----
def test_root(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    assert "NTAXCO" in r.json().get("message", "")


# ---- admin email login ----
def test_admin_login_success(s):
    r = s.post(f"{API}/auth/admin/login", json={"email": "chinmayiracharla58@gmail.com", "password": "Admin@123"})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["user"]["role"] == "admin"
    assert d["user"]["email"] == "chinmayiracharla58@gmail.com"
    assert d["access_token"] and d["refresh_token"]


def test_admin_login_wrong_password(s):
    r = s.post(f"{API}/auth/admin/login", json={"email": "chinmayiracharla58@gmail.com", "password": "wrong"})
    assert r.status_code == 401


def test_admin_login_unknown_email(s):
    r = s.post(f"{API}/auth/admin/login", json={"email": "nobody@x.com", "password": "Admin@123"})
    assert r.status_code == 401


# ---- send-otp ----
@pytest.mark.parametrize("mobile,role", [
    ("9876543210", "admin"),
    ("9876543211", "employee"),
    ("9876543212", "customer"),
    ("9876543213", "agent"),
])
def test_send_otp_valid(s, mobile, role):
    r = s.post(f"{API}/auth/mobile/send-otp", json={"mobile": mobile, "role": role})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["otp"] == "123456"


def test_send_otp_invalid_mobile(s):
    r = s.post(f"{API}/auth/mobile/send-otp", json={"mobile": "12345", "role": "employee"})
    assert r.status_code == 422


def test_send_otp_unknown_user(s):
    r = s.post(f"{API}/auth/mobile/send-otp", json={"mobile": "9999999999", "role": "employee"})
    assert r.status_code == 404


# ---- verify-otp ----
@pytest.mark.parametrize("mobile,role", [
    ("9876543210", "admin"),
    ("9876543211", "employee"),
    ("9876543212", "customer"),
    ("9876543213", "agent"),
])
def test_verify_otp_success(s, mobile, role):
    r = s.post(f"{API}/auth/mobile/verify-otp", json={"mobile": mobile, "otp": "123456", "role": role})
    assert r.status_code == 200, r.text
    d = r.json()["data"]
    assert d["user"]["role"] == role
    assert d["access_token"]


def test_verify_otp_wrong_otp(s):
    r = s.post(f"{API}/auth/mobile/verify-otp", json={"mobile": "9876543211", "otp": "000000", "role": "employee"})
    assert r.status_code == 401


# ---- /me, refresh, logout ----
@pytest.fixture
def admin_tokens(s):
    r = s.post(f"{API}/auth/admin/login", json={"email": "chinmayiracharla58@gmail.com", "password": "Admin@123"})
    return r.json()["data"]


def test_me_success(s, admin_tokens):
    r = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {admin_tokens['access_token']}"})
    assert r.status_code == 200
    assert r.json()["data"]["role"] == "admin"


def test_me_no_token(s):
    r = s.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_me_invalid_token(s):
    r = s.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401


def test_refresh_token(s, admin_tokens):
    r = s.post(f"{API}/auth/refresh", json={"refresh_token": admin_tokens["refresh_token"]})
    assert r.status_code == 200
    assert r.json()["data"]["access_token"]


def test_refresh_with_access_token_rejected(s, admin_tokens):
    r = s.post(f"{API}/auth/refresh", json={"refresh_token": admin_tokens["access_token"]})
    assert r.status_code == 401


def test_logout(s, admin_tokens):
    r = s.post(f"{API}/auth/logout", headers={"Authorization": f"Bearer {admin_tokens['access_token']}"})
    assert r.status_code == 200
