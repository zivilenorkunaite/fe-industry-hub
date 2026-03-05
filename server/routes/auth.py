"""Auth route: current user info."""

from fastapi import APIRouter, Depends
from server.auth import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user
