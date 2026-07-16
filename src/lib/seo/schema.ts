import site from "./site.json";

/**
 * Fonte única de verdade para JSON-LD nas páginas React.
 * As landings estáticas (src/landing/*.html) recebem o mesmo schema via
 * scripts/seo/inject-landing-seo.mjs, que lê este mesmo site.json.
 */

const ORG_ID = `${site.url}/#organization`;
const WEBSITE_ID = `${site.url}/#website`;

export type JsonLdObject = Record<string, unknown>;

export function organizationSchema(): JsonLdObject {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: site.name,
    legalName: site.legalName,
    url: `${site.url}/`,
    logo: site.logo,
    image: site.defaultOgImage,
    description: site.description,
    slogan: site.slogan,
    knowsAbout: site.knowsAbout,
    areaServed: site.areaServed,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      telephone: site.phone,
      availableLanguage: ["Portuguese"],
    },
    employee: {
      "@type": "Person",
      name: site.consultant.name,
      jobTitle: site.consultant.jobTitle,
      worksFor: { "@id": ORG_ID },
    },
  };
}

export function websiteSchema(): JsonLdObject {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: `${site.url}/`,
    name: site.name,
    description: site.description,
    inLanguage: site.inLanguage,
    publisher: { "@id": ORG_ID },
  };
}

type PageKey = keyof typeof site.pages;

export function breadcrumbSchema(path: PageKey): JsonLdObject | null {
  const page = site.pages[path];
  if (!page || !("breadcrumb" in page) || !page.breadcrumb) return null;
  return {
    "@type": "BreadcrumbList",
    itemListElement: page.breadcrumb.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: b.name,
      item: `${site.url}${b.path === "/" ? "/" : b.path}`,
    })),
  };
}

export function serviceSchema(path: PageKey): JsonLdObject | null {
  const page = site.pages[path] as (typeof site.pages)[PageKey] & {
    service?: { name: string; description: string; serviceType: string; price: string };
  };
  if (!page || !page.service) return null;
  const s = page.service;
  return {
    "@type": "Service",
    name: s.name,
    serviceType: s.serviceType,
    description: s.description,
    provider: { "@id": ORG_ID },
    areaServed: site.areaServed,
    url: `${site.url}${path}`,
    offers: {
      "@type": "Offer",
      price: s.price,
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
      url: `${site.url}${path}`,
    },
  };
}

/** Envelope @graph com os schemas informados (remove nulos). */
export function graph(...nodes: (JsonLdObject | null)[]): JsonLdObject {
  return { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) as JsonLdObject[] };
}

export { site };
