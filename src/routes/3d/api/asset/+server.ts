import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET({ url, fetch }: RequestEvent): Promise<Response> {
    try {
        const assetName = url.searchParams.get('name');
        if (!assetName) {
            throw error(400, 'Asset name is required');
        }

        const response = await fetch(`https://github.com/YZhLu/chess3d/releases/download/Asset/${assetName}`);
        
        if (!response.ok) {
            throw error(response.status, `Failed to fetch asset: ${response.statusText}`);
        }

        // Get the binary data
        const arrayBuffer: ArrayBuffer = await response.arrayBuffer();
        
        // Return with appropriate headers
        return new Response(arrayBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/octet-stream',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (err) {
        console.error('Error fetching asset:', err);
        throw error(500, 'Failed to load asset');
    }
}