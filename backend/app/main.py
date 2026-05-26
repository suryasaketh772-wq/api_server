# Force reload to apply 2s interval settings
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.routes import router as client_router
from admin_api.routes import admin_router
from backend.app.polling import bullion_polling_service
from metrics.manager import api_server_metrics_manager

# Setup unified system logging format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("api_server.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages FastAPI application startup and shutdown events.
    Spawns background price polling and admin metrics loops on startup,
    and terminates all active loops on shutdown.
    """
    logger.info("Initializing api_server backend modules...")
    
    # 1. Fire up background price poller (DPGold API or Mock fallback)
    bullion_polling_service.start()
    
    # 2. Fire up background 1-second admin metrics harvesting loop
    api_server_metrics_manager.start_monitoring_loop()
    
    # 3. Securely attach custom AdminLogHandler after Uvicorn's logging setup completes
    try:
        from admin_api.routes import admin_handler
        root_logger = logging.getLogger()
        if admin_handler not in root_logger.handlers:
            root_logger.addHandler(admin_handler)
            
        # Ensure we capture direct logs from Uvicorn and local modules
        for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access", "api_server"]:
            l = logging.getLogger(logger_name)
            if admin_handler not in l.handlers:
                l.addHandler(admin_handler)
        
        logger.info("Admin WebSocket Log Handler successfully bound to Uvicorn / App loggers.")
    except Exception as ex:
        logger.error(f"Failed to bind dynamic admin logging handler: {ex}")
        
    yield
    
    # Gracefully cancel background tasks and close sessions
    logger.info("Stopping api_server backend services...")
    await bullion_polling_service.stop()
    await api_server_metrics_manager.stop_monitoring_loop()

# Instantiate core FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan
)

# Apply CORS middleware dynamically to support dashboard and mobile web requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach client endpoints router
app.include_router(client_router)

# Attach admin endpoints router (REST login, session verify, WS Admin metrics stream)
app.include_router(admin_router)
