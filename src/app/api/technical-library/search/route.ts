import {NextResponse} from "next/server";
import {searchTechnicalLibrary,technicalLibraryStats} from "@/lib/technical-library";

export const runtime = "nodejs";

export async function POST(request:Request) {
  const body = await request.json() as {query?:string;limit?:number};
  const query = body.query?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({error:"Digite ao menos dois caracteres."},{status:400});
  return NextResponse.json({query,results:searchTechnicalLibrary(query,body.limit),stats:technicalLibraryStats()});
}
