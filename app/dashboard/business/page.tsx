export default function Business() {
  return <main style={{ maxWidth: 480, margin: "0 auto", padding: 20 }}><h1>Business</h1><p>Create the business with the create_business RPC after login. Staff cannot spoof business_id; membership is written from auth.uid().</p><a href="/dashboard">Back</a></main>;
}
