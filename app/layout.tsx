import type { Metadata } from "next";
export const metadata:Metadata={title:"García Herreros FC",description:"Gestión interna del club",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}
