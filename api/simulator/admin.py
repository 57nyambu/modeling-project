from django.contrib import admin

from .models import SimulationRun, StrategyComparison


@admin.register(SimulationRun)
class SimulationRunAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "strategy")
    list_filter = ("strategy",)
    readonly_fields = ("created_at",)


@admin.register(StrategyComparison)
class StrategyComparisonAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "replications")
    readonly_fields = ("created_at",)
