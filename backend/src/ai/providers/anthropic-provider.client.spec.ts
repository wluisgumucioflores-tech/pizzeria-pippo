import { AnthropicProviderClient } from './anthropic-provider.client';

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

describe('AnthropicProviderClient', () => {
  let client: AnthropicProviderClient;

  beforeEach(() => {
    mockCreate.mockReset();
    client = new AnthropicProviderClient();
  });

  it('devuelve el texto de la respuesta, recortado', async () => {
    mockCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '  hola  ' }],
    });

    const result = await client.complete(
      { apiKey: 'key', model: 'claude-haiku-4-5-20251001' },
      'system',
      [{ role: 'user', content: 'hola' }],
    );

    expect(result).toEqual({ type: 'text', content: 'hola' });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5-20251001',
        system: 'system',
        messages: [{ role: 'user', content: 'hola' }],
      }),
    );
  });

  it('devuelve string vacío si el bloque de respuesta no es texto', async () => {
    mockCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'image' }],
    });

    const result = await client.complete(
      { apiKey: 'key', model: 'claude-haiku-4-5-20251001' },
      'system',
      [{ role: 'user', content: 'hola' }],
    );

    expect(result).toEqual({ type: 'text', content: '' });
  });

  it('devuelve tool_calls cuando stop_reason es tool_use', async () => {
    mockCreate.mockResolvedValue({
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          id: 'call_1',
          name: 'get_stock_alerts',
          input: { branch_id: 'b1' },
        },
      ],
    });

    const result = await client.complete(
      { apiKey: 'key', model: 'claude-haiku-4-5-20251001' },
      'system',
      [{ role: 'user', content: 'hay poco stock?' }],
      [
        {
          name: 'get_stock_alerts',
          description: 'alertas de stock',
          inputSchema: {},
        },
      ],
    );

    expect(result).toEqual({
      type: 'tool_calls',
      calls: [
        {
          id: 'call_1',
          name: 'get_stock_alerts',
          arguments: { branch_id: 'b1' },
        },
      ],
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          {
            name: 'get_stock_alerts',
            description: 'alertas de stock',
            input_schema: {},
          },
        ],
      }),
    );
  });

  it('mapea un mensaje de rol tool a un tool_result de usuario', async () => {
    mockCreate.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'listo' }],
    });

    await client.complete(
      { apiKey: 'key', model: 'claude-haiku-4-5-20251001' },
      'system',
      [
        { role: 'user', content: 'hay poco stock?' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            { id: 'call_1', name: 'get_stock_alerts', arguments: {} },
          ],
        },
        { role: 'tool', content: 'sin alertas', toolCallId: 'call_1' },
      ],
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'user', content: 'hay poco stock?' },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'call_1',
                name: 'get_stock_alerts',
                input: {},
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'call_1',
                content: 'sin alertas',
              },
            ],
          },
        ],
      }),
    );
  });
});
