import { NextResponse } from 'next/server';

// Helper function to set CORS headers
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*', // For production, replace '*' with your specific app origin if needed
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

// Handle OPTIONS preflight requests (browsers/mobile webviews send this before a POST request)
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { 
          status: 400,
          headers: corsHeaders() // Include headers here
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Hello ${username}, your serverless backend is working perfectly!`,
        timestamp: new Date().toISOString(),
      },
      { 
        status: 200,
        headers: corsHeaders() // Include headers here
      }
    );

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON payload' },
      { 
        status: 500,
        headers: corsHeaders() // Include headers here
      }
    );
  }
}