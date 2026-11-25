from django.urls import path

from . import views

urlpatterns = [
    path("meta", views.meta_view),
    path("runs", views.runs_view),
    path("runs/<int:pk>", views.run_detail_view),
    path("runs/<int:pk>/customers.csv", views.run_csv_view),
    path("runs/<int:pk>/charts/<slug:name>.png", views.run_chart_view),
    path("comparisons", views.comparisons_view),
    path("comparisons/<int:pk>", views.comparison_detail_view),
    path("comparisons/<int:pk>/charts/<slug:name>.png", views.comparison_chart_view),
    path("validation", views.validation_view),
]
