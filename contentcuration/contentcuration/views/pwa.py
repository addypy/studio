import os

from django.contrib.staticfiles import finders
from django.contrib.staticfiles.storage import staticfiles_storage
from django.views.generic.base import TemplateView


class ServiceWorkerView(TemplateView):
    content_type = "application/javascript"
    template_name = "pwa/service_worker.js"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # Code to access the compiled serivce worker in developer mode
        # if getattr(settings, "DEBUG", False):
        import requests

        request = requests.get("http://0.0.0.0:4000/dist/serviceWorker.js")
        content = request.content
#        # else:
#        path = staticfiles_storage.path("studio/serviceWorker.js")
#        if not os.path.exists(path):
#            path = finders.find("studio/serviceWorker.js")
#        with open(path) as f:
#            content = f.read()
        context["webpack_service_worker"] = content
        return context


class ManifestView(TemplateView):
    content_type = "application/json"
    template_name = "pwa/manifest.json"
