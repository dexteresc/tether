from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
from app.services.extraction import get_extraction_service
from app.services.supabase_sync import SupabaseSyncService
from app.services.auth import verify_supabase_jwt, create_service_role_client


router = APIRouter()


@router.websocket("/ws/extract")
async def websocket_extract(websocket: WebSocket):
    """
    WebSocket endpoint for streaming intelligence extraction.

    Protocol:
    1. Client connects
    2. Client sends: {"token": "jwt_token"}
    3. Server verifies token and responds: {"status": "authenticated", "user_id": "..."}
    4. Client sends: {"text": "...", "context": "...", "source_code": "..."}
    5. Server sends: {"status": "extracting"}
    6. Server sends: {"type": "extraction", "data": {...}}
    7. Server sends: {"status": "syncing"}
    8. Server sends: {"type": "sync_results", "data": {...}}
    9. Repeat from step 4 or close connection
    """
    await websocket.accept()

    try:
        user_id = None

        # Authentication phase
        auth_message = await websocket.receive_text()
        auth_data = json.loads(auth_message)

        if "token" not in auth_data:
            await websocket.send_json({"error": "Token required"})
            await websocket.close()
            return

        # Verify JWT token
        user_id = verify_supabase_jwt(auth_data["token"])
        if not user_id:
            await websocket.send_json({"error": "Invalid token"})
            await websocket.close()
            return

        # Send authentication success
        await websocket.send_json({"status": "authenticated", "user_id": user_id})

        # Main extraction loop
        while True:
            # Receive extraction request
            message = await websocket.receive_text()
            data = json.loads(message)

            if "text" not in data:
                await websocket.send_json({"error": "Text required"})
                continue

            text = data["text"]
            context = data.get("context")
            source_code = data.get("source_code", "LLM")

            # Extraction phase
            await websocket.send_json({"status": "extracting"})

            try:
                # Extract intelligence
                extraction_service = get_extraction_service()
                extraction = extraction_service.extract_intelligence(text, context)

                # Send extraction result
                await websocket.send_json(
                    {
                        "type": "extraction",
                        "data": extraction.model_dump(),
                    }
                )

                # Sync phase
                await websocket.send_json({"status": "syncing"})

                # Create authenticated Supabase client
                supabase = create_service_role_client()

                # Sync to database
                sync_service = SupabaseSyncService(supabase, user_id)
                sync_results = sync_service.sync_extraction(extraction, source_code)

                # Send sync results
                await websocket.send_json(
                    {
                        "type": "sync_results",
                        "data": sync_results.model_dump(),
                    }
                )

                # Send completion
                await websocket.send_json({"status": "complete"})

            except Exception as e:
                await websocket.send_json(
                    {"error": f"Extraction/sync failed: {str(e)}"}
                )

    except WebSocketDisconnect:
        print(f"WebSocket disconnected for user: {user_id}")
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.send_json({"error": str(e)})
        except:
            pass
