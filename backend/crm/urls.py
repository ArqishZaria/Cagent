from rest_framework.routers import DefaultRouter

from crm.views import InteractionViewSet, LeadViewSet

router = DefaultRouter()
router.register("leads", LeadViewSet, basename="lead")
router.register("interactions", InteractionViewSet, basename="interaction")

urlpatterns = router.urls