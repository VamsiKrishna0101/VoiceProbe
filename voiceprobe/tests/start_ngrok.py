import sys
import os
import asyncio

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

import ngrok

async def main():
    authtoken = os.getenv("NGROK_AUTHTOKEN")
    if not authtoken:
        print("ERROR: Add NGROK_AUTHTOKEN to your .env file")
        print("  Get one free at: https://dashboard.ngrok.com/get-started/your-authtoken")
        sys.exit(1)

    listener = await ngrok.forward(8000, authtoken=authtoken)
    public_url = listener.url()
    wss_url = public_url.replace("https://", "wss://")

    print(f"Ngrok tunnel active!")
    print(f"  HTTPS: {public_url}")
    print(f"  WSS:   {wss_url}")
    print(f"\nAdd this to your .env:")
    print(f"  NGROK_URL={wss_url}")
    print(f"\nPress Ctrl+C to stop the tunnel.")

    try:
        await asyncio.Event().wait()
    except KeyboardInterrupt:
        print("Tunnel closed.")
        await ngrok.disconnect(public_url)

asyncio.run(main())
