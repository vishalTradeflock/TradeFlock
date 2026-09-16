import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFeedItems } from "./rss.ts";

describe("parseFeedItems", () => {
  it("keeps enclosure and media:content image URLs from the feed", () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Oracle stock jumps 7% on earnings beat</title>
          <link>https://www.cnbc.com/oracle</link>
          <pubDate>Tue, 15 Sep 2026 18:31:00 GMT</pubDate>
          <description>Oracle beat estimates.</description>
          <enclosure url="https://image.cnbcfm.com/oracle.jpg?v=1&amp;amp;w=1600" type="image/jpeg" />
        </item>
        <item>
          <title>Fed holds rates as labor cools</title>
          <link>https://www.federalreserve.gov/rates</link>
          <media:content url="https://www.federalreserve.gov/cover.png" medium="image" />
        </item>
      </channel></rss>
    `;
    const items = parseFeedItems(xml);
    assert.equal(items[0]?.imageUrl, "https://image.cnbcfm.com/oracle.jpg?v=1&w=1600");
    assert.equal(items[1]?.imageUrl, "https://www.federalreserve.gov/cover.png");
  });
});
