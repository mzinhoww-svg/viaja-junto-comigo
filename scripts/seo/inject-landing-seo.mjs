#!/usr/bin/env node
/**
 * Injeta SEO (meta única + canonical + Open Graph/Twitter + JSON-LD) no <head>
 * das landings estáticas em src/landing/*.html.
 *
 * - Fonte de verdade dos metadados: src/lib/seo/site.json
 * - FAQPage e HowTo são derivados DO PRÓPRIO HTML (perguntas/respostas e passos),
 *   garantindo que o schema case exatamente com o conteúdo visível (exigência do Google).
 * - Idempotente: reescreve o bloco entre <!-- SEO:BEGIN --> e <!-- SEO:END -->.
 *
 * Uso:  node scripts/seo/inject-landing-seo.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const site = JSON.parse(readFileSync(resolve(ROOT, "src/lib/seo/site.json"), "utf-8"));

const ORG_ID = `${site.url}/#organization`;
const WEBSITE_ID = `${site.url}/#website`;

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
const stripTags = (s) =>
  decode(s.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

function parseFaq(body) {
  const re =
    /<details class="faq-item[^"]*">\s*<summary>(.*?)<span class="fq-ic">.*?<\/summary>\s*<div class="fq-body">(.*?)<\/div>\s*<\/details>/gs;
  const out = [];
  let m;
  while ((m = re.exec(body))) out.push({ q: stripTags(m[1]), a: stripTags(m[2]) });
  return out;
}

function parseSteps(body) {
  const re =
    /<div class="step[^"]*"[^>]*>\s*<div class="step-n">(\d+)<\/div>\s*<h4>(.*?)<\/h4>\s*<p>(.*?)<\/p>/gs;
  const out = [];
  let m;
  while ((m = re.exec(body)))
    out.push({ n: Number(m[1]), name: stripTags(m[2]), text: stripTags(m[3]) });
  return out;
}

function organizationNode() {
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

function websiteNode() {
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

function breadcrumbNode(page) {
  if (!page.breadcrumb) return null;
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

function serviceNode(path, page) {
  if (!page.service) return null;
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

function faqNode(faqs) {
  if (!faqs.length) return null;
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

function howToNode(steps, name) {
  if (steps.length < 2) return null;
  return {
    "@type": "HowTo",
    name,
    step: steps
      .sort((a, b) => a.n - b.n)
      .map((s) => ({ "@type": "HowToStep", position: s.n, name: s.name, text: s.text })),
  };
}

function servicesItemList() {
  const paths = ["/vistos", "/passaporte", "/roteiros", "/milhas"];
  return {
    "@type": "ItemList",
    name: "Serviços da Viajaly",
    itemListElement: paths.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: site.pages[p]?.service?.name ?? site.pages[p]?.ogTitle ?? p,
      url: `${site.url}${p}`,
    })),
  };
}

function buildGraph(path, page, faqs, steps) {
  const nodes = [organizationNode(), websiteNode(), breadcrumbNode(page)];
  if (path === "/") {
    nodes.push(servicesItemList());
  } else {
    nodes.push(serviceNode(path, page));
  }
  nodes.push(faqNode(faqs));
  nodes.push(howToNode(steps, `Como funciona: ${page.service?.name ?? site.name}`));
  return { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) };
}

function block(path, page, graph) {
  const jsonld = JSON.stringify(graph).replace(/</g, "\\u003c");
  const url = `${site.url}${path}`;
  return [
    `<!-- SEO:BEGIN (gerado por scripts/seo/inject-landing-seo.mjs — não editar à mão) -->`,
    `<meta name="description" content="${page.description}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta name="robots" content="index, follow, max-image-preview:large">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Viajaly">`,
    `<meta property="og:locale" content="pt_BR">`,
    `<meta property="og:title" content="${page.ogTitle}">`,
    `<meta property="og:description" content="${page.description}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${page.ogImage}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${page.ogTitle}">`,
    `<meta name="twitter:description" content="${page.description}">`,
    `<meta name="twitter:image" content="${page.ogImage}">`,
    `<script type="application/ld+json">${jsonld}</script>`,
    `<!-- SEO:END -->`,
  ].join("\n");
}

const FILES = {
  "/": "src/landing/home.html",
  "/passaporte": "src/landing/passaporte.html",
  "/roteiros": "src/landing/roteiros.html",
  "/milhas": "src/landing/milhas.html",
};

let changed = 0;
for (const [path, rel] of Object.entries(FILES)) {
  const file = resolve(ROOT, rel);
  let html = readFileSync(file, "utf-8");
  const page = site.pages[path];
  const faqs = parseFaq(html);
  const steps = parseSteps(html);
  const graph = buildGraph(path, page, faqs, steps);
  const seo = block(path, page, graph);

  // remove bloco anterior + qualquer <meta name="description"> avulsa
  html = html.replace(/\n?[ \t]*<!-- SEO:BEGIN[\s\S]*?<!-- SEO:END -->/g, "");
  html = html.replace(/[ \t]*<meta name="description"[^>]*>\n?/g, "");

  // insere logo após o </title> (replacer em função para não interpretar `$` do conteúdo)
  html = html.replace(/<\/title>/, (m) => `${m}\n${seo}`);

  writeFileSync(file, html);
  changed++;
  console.log(`✓ ${rel}  (FAQ: ${faqs.length}, passos: ${steps.length})`);
}
console.log(`\n${changed} landing(s) atualizada(s).`);
