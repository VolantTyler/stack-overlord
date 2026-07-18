import { getAppIconResponse } from "@/lib/app-icons";

export async function GET(request: Request) {
  return getAppIconResponse(request, "favicon");
}
