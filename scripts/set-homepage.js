// Points the repository's Website link (About, on GitHub) at the live site. The release workflow runs
// it after each deploy, so the link follows the site, for example to a custom domain added later.
//   node scripts/set-homepage.js <pages-project>
// Needs CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, GITHUB_REPOSITORY (owner/name) and GH_TOKEN, a
// token with "Administration: write" on the repository: the workflow's own token cannot edit repo
// settings.

/** The site's address: the first active custom domain, else the project's pages.dev address. */
function siteUrl(subdomain, domains) {
  const custom = domains.find((d) => d.status === 'active');
  return `https://${custom ? custom.name : subdomain}/`;
}

async function request(url, token, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const body = await res.json();
  if (!res.ok)
    throw new Error(`${init.method || 'GET'} ${url}: ${res.status} ${JSON.stringify(body)}`);
  return body;
}

async function main(project) {
  const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
  const githubToken = process.env.GH_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const pages = `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${project}`;
  const { result: info } = await request(pages, cloudflareToken);
  const { result: domains } = await request(`${pages}/domains`, cloudflareToken);
  const url = siteUrl(info.subdomain, domains);

  const repo = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}`;
  const { homepage } = await request(repo, githubToken);
  if (homepage === url) {
    console.log(`The Website link is already ${url}`);
    return;
  }
  await request(repo, githubToken, { method: 'PATCH', body: JSON.stringify({ homepage: url }) });
  console.log(`Set the Website link to ${url} (was ${homepage || 'empty'})`);
}

module.exports = { siteUrl };

if (require.main === module) {
  main(process.argv[2]).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
