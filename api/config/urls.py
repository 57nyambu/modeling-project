from pathlib import Path

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, HttpResponse
from django.urls import include, path, re_path
from django.utils._os import safe_join
from django.views.static import serve

# Single-server mode: after `npm run build` in web/, Django also serves the built
# React app, so one `python manage.py runserver` is enough for a demo.
WEB_DIST: Path = Path(settings.BASE_DIR).parent / "web" / "dist"


def web_app(request, path: str = ""):
    if not (WEB_DIST / "index.html").exists():
        return HttpResponse(
            "The web interface has not been built. Run `npm run build` in the web folder, "
            "or use the Vite dev server on http://localhost:5173.",
            status=404, content_type="text/plain",
        )
    if path:
        try:
            candidate = Path(safe_join(WEB_DIST, path))
        except Exception:  # path escapes the dist folder
            candidate = None
        if candidate is not None and candidate.is_file():
            return serve(request, path, document_root=str(WEB_DIST))
    return FileResponse(open(WEB_DIST / "index.html", "rb"), content_type="text/html")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("simulator.urls")),
    re_path(r"^(?!api/|admin/|static/)(?P<path>.*)$", web_app),
]
