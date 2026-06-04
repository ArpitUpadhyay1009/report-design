"use client";

import { useState } from "react";
import Header from "@/components/header/header";
import LoginForm from "@/components/login-form/loginForm";
import ProductsReport from "@/components/products-report/productsReport";
import { products } from "@/data/products";
import type { Profile } from "@/types/profile";

export default function Home() {
  const [user, setUser] = useState<Profile | null>(null);

  if (!user) {
    return <LoginForm onSuccess={setUser} />;
  }

  return (
    <>
      <Header user={user} onLogout={() => setUser(null)} />
      <main>
        <ProductsReport products={products} user={user} />
      </main>
    </>
  );
}
