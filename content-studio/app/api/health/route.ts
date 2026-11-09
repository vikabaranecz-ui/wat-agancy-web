import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export function GET(){return NextResponse.json({product:'WAT Content Studio',version:'0.1.0',mode:'prototype',capabilities:{preview:true,local_editor:true,png_export:true,openai_configured:!!process.env.OPENAI_API_KEY,supabase_configured:!!process.env.SUPABASE_SECRET_KEY,buffer_configured:!!process.env.BUFFER_API_KEY,n8n_secret_configured:!!process.env.STUDIO_AGENT_SECRET},publishing_enabled:false});}
