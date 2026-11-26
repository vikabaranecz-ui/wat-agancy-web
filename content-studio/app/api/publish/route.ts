import {NextResponse} from 'next/server';
export async function POST(){return NextResponse.json({error:'Publishing disabled until an authenticated, database-enforced immutable-revision approval gate and Buffer channel verification are operational. Preview approval alone is never sufficient.'},{status:503})}
