export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, action } = body;

    if (!email || !password) {
      return Response.json(
        { success: false, error: 'Email and password required' },
        { status: 400 }
      );
    }

    if (action === 'login') {
      // Mock login - replace with actual authentication
      const user = {
        id: '1',
        email,
        name: 'Pet Sanctuary User',
        role: 'adopter'
      };

      return Response.json({
        success: true,
        data: { user, token: 'mock-jwt-token' }
      });
    }

    if (action === 'register') {
      // Mock registration - replace with actual user creation
      const newUser = {
        id: Date.now().toString(),
        email,
        name: body.name || 'New User',
        role: body.role || 'adopter',
        createdAt: new Date().toISOString()
      };

      return Response.json({
        success: true,
        data: { user: newUser, token: 'mock-jwt-token' }
      }, { status: 201 });
    }

    return Response.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    return Response.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}