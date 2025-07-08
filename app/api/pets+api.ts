export async function GET(request: Request) {
  try {
    // Mock data for now - replace with actual database queries
    const pets = [
      {
        id: '1',
        name: 'Luna',
        species: 'dog',
        breed: 'Golden Retriever',
        age: 3,
        status: 'available'
      }
    ];

    return Response.json({ 
      success: true, 
      data: pets 
    });
  } catch (error) {
    return Response.json(
      { success: false, error: 'Failed to fetch pets' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.species || !body.breed) {
      return Response.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Mock creation - replace with actual database insert
    const newPet = {
      id: Date.now().toString(),
      ...body,
      createdAt: new Date().toISOString()
    };

    return Response.json({ 
      success: true, 
      data: newPet 
    }, { status: 201 });
  } catch (error) {
    return Response.json(
      { success: false, error: 'Failed to create pet' },
      { status: 500 }
    );
  }
}