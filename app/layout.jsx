import './globals.css'

export const metadata = {
  title: 'LeadFinder AI',
  description: 'Find B2B leads and track your outreach funnel',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
