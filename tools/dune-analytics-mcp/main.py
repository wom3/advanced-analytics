# dune_analytics_mcp_httpx.py
from mcp.server.fastmcp import FastMCP
import httpx
import os
from dotenv import load_dotenv
import pandas as pd
import time

# Load environment variables
load_dotenv()

# Initialize MCP server
mcp = FastMCP(
    name="Dune Analytics MCP Server"
)

# Configuration
DUNE_API_KEY = os.getenv("DUNE_API_KEY")
BASE_URL = "https://api.dune.com/api/v1"
HEADERS = {"X-Dune-API-Key": DUNE_API_KEY}


def _start_execution(client: httpx.Client, query_id: int) -> dict:
    execute_urls = [
        f"{BASE_URL}/query/execute/{query_id}",
        f"{BASE_URL}/query/{query_id}/execute",
    ]
    last_error = None
    for url in execute_urls:
        try:
            response = client.post(url, headers=HEADERS, timeout=300)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as err:
            last_error = err
            continue
    raise last_error if last_error else RuntimeError("Failed to start query execution")

@mcp.tool()
def get_latest_result(query_id: int) -> str:
    """Get the latest results for a specific query ID as a CSV string on dune analytics"""
    try:
        # Fetch latest results
        url = f"{BASE_URL}/query/{query_id}/results"
        with httpx.Client(trust_env=False) as client:
            response = client.get(url, headers=HEADERS, timeout=300)
            response.raise_for_status()
            data = response.json()
            
        # Convert results to DataFrame
        result_data = data.get("result", {}).get("rows", [])
        if not result_data:
            return "No data available"
        
        df = pd.DataFrame(result_data)
        return df.to_csv(index=False)
    except httpx.HTTPError as e:
        return f"HTTP error fetching query results: {str(e)}"
    except Exception as e:
        return f"Error processing query results: {str(e)}"

@mcp.tool()
def run_query(query_id: int) -> str:
    """Run a query by ID and return results as a CSV string on dune analytics"""
    try:
        with httpx.Client(trust_env=False) as client:
            # Try known execute endpoint variants for compatibility.
            execution_data = _start_execution(client, query_id)
            execution_id = execution_data.get("execution_id")
            
            if not execution_id:
                return "Failed to start query execution"

            # Poll for status until complete
            status_url = f"{BASE_URL}/execution/{execution_id}/status"
            while True:
                status_response = client.get(status_url, headers=HEADERS)
                status_response.raise_for_status()
                status_data = status_response.json()
                state = status_data.get("state")
                
                if state in {"EXECUTING", "PENDING", "QUERY_STATE_EXECUTING", "QUERY_STATE_PENDING"}:
                    time.sleep(5)  # Wait before polling again
                elif state in {"COMPLETED", "QUERY_STATE_COMPLETED"}:
                    break
                else:
                    return f"Query execution failed with state: {state}"

            # Fetch results
            results_url = f"{BASE_URL}/execution/{execution_id}/results"
            results_response = client.get(results_url, headers=HEADERS)
            results_response.raise_for_status()
            results_data = results_response.json()
        
        # Convert results to DataFrame
        result_data = results_data.get("result", {}).get("rows", [])
        if not result_data:
            return "No data available"
        
        df = pd.DataFrame(result_data)
        return df.to_csv(index=False)
    except httpx.HTTPError as e:
        return f"HTTP error running query: {str(e)}"
    except Exception as e:
        return f"Error processing query: {str(e)}"

# Run the server
if __name__ == "__main__":
    mcp.run()
