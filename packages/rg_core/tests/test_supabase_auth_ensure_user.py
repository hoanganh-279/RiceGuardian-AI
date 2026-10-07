"""Unit tests for UUID-safe Supabase Auth ensure_user."""

from unittest.mock import patch

import pytest

from core.services import supabase_auth


def test_ensure_user_updates_when_id_exists():
    with (
        patch.object(supabase_auth, "get_user", return_value={"id": "aaa", "email": "a@b.c"}),
        patch.object(supabase_auth, "update_user_credentials", return_value={"id": "aaa"}) as update,
        patch.object(supabase_auth, "create_user") as create,
    ):
        result = supabase_auth.ensure_user(
            user_id="aaa",
            email="a@b.c",
            password="Demo@123",
            full_name="A",
            role="farmer",
            phone="0901234567",
        )
    assert result["id"] == "aaa"
    update.assert_called_once()
    create.assert_not_called()


def test_ensure_user_rejects_email_owned_by_other_id():
    with (
        patch.object(supabase_auth, "get_user", return_value=None),
        patch.object(
            supabase_auth,
            "find_user_by_email",
            return_value={"id": "other-id", "email": "farmer@demo.vn"},
        ),
    ):
        with pytest.raises(supabase_auth.SupabaseAuthError) as exc:
            supabase_auth.ensure_user(
                user_id="22222222-2222-4222-8222-222222222004",
                email="farmer@demo.vn",
                password="Demo@123",
                full_name="Farmer",
                role="farmer",
                phone="0901234567",
            )
    assert exc.value.status == 409
    assert "không khớp" in exc.value.message


def test_create_user_puts_role_in_app_metadata():
    with patch.object(supabase_auth, "_request", return_value={"id": "u1"}) as req:
        supabase_auth.create_user(
            user_id="u1",
            email="farmer@demo.vn",
            password="Demo@123",
            full_name="Farmer",
            role="farmer",
            phone="0901234567",
        )
    body = req.call_args.kwargs["json"]
    assert body["app_metadata"]["role"] == "farmer"
    assert body["app_metadata"]["phone"] == "0901234567"
    assert "role" not in body["user_metadata"]
