/**
 * The developer documentation (/zh/developers/), Chinese. The same statements as ./en.ts, block for block (tests/developers-page.test.ts
 * compares the two); see there for the sources. Code blocks are the same in both languages.
 */
import { developerApi, site } from "../../data/site.ts";
import type { DevelopersContent } from "../help/types.ts";
import { developersEn } from "./en.ts";

const support = `[${site.contact.email}](mailto:${site.contact.email})`;
/** The code blocks of the English page, in order: the commands and responses are the same whatever the page's language. */
const code = developersEn.sections.flatMap((section) => section.blocks.filter((block) => "code" in block));
const codeBlock = (index: number) => code[index]!;

export const developersZh: DevelopersContent = {
  title: "在 Abnormal 上开发",
  summary:
    "Abnormal 工作区的管理 API 和 MCP 服务器：用你自己的代码或 AI Agent 管理域名、邮箱、别名、邮件列表和 Webhook，密钥按权限范围授权，事件带签名。",
  reviewed: "2026-11-12",
  sections: [
    {
      title: "API 能做什么",
      blocks: [
        {
          p: "API 管理一个工作区的邮件服务。它能做的事，管理员在管理控制台里也都能做；有了 API，就可以交给脚本、集成或 Agent 去做。",
        },
        {
          ul: [
            "**域名**：验证所有权、接入域名、检查 DNS、设置 catch-all、添加别名域名。",
            "**邮箱**：创建、删除和恢复邮箱，修改密码、状态、容量、备注和每日发信上限。",
            "**地址**：转发规则、普通别名和邮件列表。",
            "**合规与报表**：法律保留、不活跃邮箱、各域名的存储用量和发信最多的邮箱。",
            "**事件**：邮箱、域名、订单、批量任务和安全事件的签名 Webhook。",
            "**投递**：抑制列表和邮件追踪。",
            "**批量**：把多项修改放进一个按顺序执行、可安全重试的请求。",
          ],
        },
      ],
    },
    {
      title: "申请工作区和密钥",
      blocks: [
        {
          ol: [
            `**申请工作区。** API 属于管理控制台里的一个工作区。[申请工作区](${developerApi.signup})后会有人工审核，通过后你会作为管理员收到邀请。`,
            "**创建密钥。** 在管理控制台打开 **设置 → API 密钥**，创建一个密钥，只勾选代码需要的权限范围。只有管理员能创建密钥。",
            "**立即保存。** 完整的密钥只在创建时显示一次。把它放在密钥管理工具或环境变量里，不要写进代码仓库、网址或日志。",
          ],
        },
        {
          p: "密钥能做的事永远不会超过其所有者当前在控制台里的角色；吊销后，下一次请求就会被拒绝。工作区的每位管理员都能看到并吊销其他账号的密钥。",
        },
      ],
    },
    {
      title: "第一个请求",
      blocks: [
        {
          p: `所有请求都发往 \`${developerApi.base}\`，并以 Bearer 令牌的形式带上密钥。建议第一次先调用 \`GET /capabilities\`：它会返回可用的权限范围、功能和当前生效的限制。`,
        },
        codeBlock(0),
        {
          p: "用隐藏输入读入密钥，它就不会留在 shell 历史里。用完后运行 `unset API_KEY`。",
        },
      ],
    },
    {
      title: "权限范围",
      blocks: [
        {
          p: "每个操作需要一个权限范围，在下方的接口列表里标在操作旁边。写权限不包含对应的读权限。",
        },
        {
          ul: [
            "`domains:read`、`domains:write`：域名、接入申请、DNS 与连接状态、catch-all、别名域名。",
            "`mailboxes:read`、`mailboxes:write`：邮箱、回收站、发信上限和用量报表。",
            "`forwarders:*`、`aliases:*`、`lists:*`：转发规则、普通别名和邮件列表。",
            "`holds:*`、`webhooks:*`、`suppressions:*`、`trace:read`：法律保留、Webhook、抑制列表和邮件追踪。",
            "`agent_tasks:*`：跟进任务，即以某个邮箱身份回复邮件的 Agent。",
          ],
        },
        {
          p: "域名、转发、别名、邮件列表、法律保留和 Webhook 即使只读也需要管理员角色；邮箱和跟进任务的权限范围运营人员也能用，其中的读权限查看者也能用。",
        },
      ],
    },
    {
      title: "请求、响应与错误",
      blocks: [
        {
          ul: [
            "请求体是 JSON（`Content-Type: application/json`），最大 16 KiB。",
            '成功结果是 `{ "data": … }`，列表另带 `pagination`。创建成功返回 `201`。',
            "路径里的 `{id}` 是 API 返回的记录 ID，不是邮箱地址或域名。",
            "`POST /batch` 按顺序执行 1 到 25 个操作，并且必须带 `Idempotency-Key`：用同一个键重发同一批操作，会直接返回保存的结果，不会执行两次。",
          ],
        },
        {
          p: "所有错误的格式都一样。请根据 `code` 判断，不要根据 `message`：后者是写给人看的，内容可能会变。",
        },
        codeBlock(1),
        {
          p: "遇到超时、连接中断或 `502` 后，先读取当前状态，再决定是否重做写操作。返回 `409` 且错误码为 `provisioning_uncertain` 时，邮箱可能已经创建也可能没有：请用 `details.mailboxId` 查询，不要再创建一次。",
        },
      ],
    },
    {
      title: "频率限制",
      blocks: [
        {
          ul: [
            "按密钥计数，REST 和 MCP 合并计算。默认每分钟 300 次；当前生效的限制由 `GET /capabilities` 的 `limits.requestsPerMinute` 给出。",
            "每个响应都带 `RateLimit-Limit`、`RateLimit-Remaining`、`RateLimit-Reset` 和 `RateLimit-Policy`。",
            "超出限制时返回 `429`，并用 `Retry-After` 给出需要等待的秒数。被拒绝的请求什么都没做，等待之后重发是安全的。",
            "同一地址发来太多无效密钥，该地址会被暂时封禁，有效密钥也会被拒绝。请修好发错密钥的客户端。",
          ],
        },
      ],
    },
    {
      title: "Webhook",
      blocks: [
        {
          p: "Webhook 是一个 `https` 地址，工作区里发生事情时会向它发送 POST 请求，你就不用轮询。用 `POST /webhooks` 创建；签名密钥（`whsec_…`）只在这次响应里出现一次。每个工作区最多 10 个。",
        },
        {
          p: "每次投递都在 `X-Mailhq-Signature` 头里签名，格式为 `t=<milliseconds>,v1=<hex HMAC-SHA256>`（毫秒时间戳和十六进制的 HMAC-SHA256），签名内容是时间戳、一个点和原始请求体。先校验签名，再信任请求体：",
        },
        codeBlock(2),
        {
          ul: [
            "在 10 秒内返回 `2xx`，之后再处理业务。",
            "投递至少一次且不保证顺序：用事件的 `id` 去重。",
            "投递失败会以逐渐拉长的间隔重试约 17 小时。连续失败 3 天的 Webhook 会被停用，直到你重新启用。",
            "`POST /webhooks/{id}/test` 会发送一个测试事件，用来检查接收端。",
          ],
        },
      ],
    },
    {
      title: "给 AI Agent 用的 MCP",
      blocks: [
        {
          p: `同样的操作也作为工具提供在 MCP 服务器 \`${developerApi.mcp}\` 上（Streamable HTTP），密钥、权限范围和频率限制都相同。只给 Agent 它需要的权限范围。以 Claude Code 为例：`,
        },
        codeBlock(3),
        {
          p: "服务器暂不支持 OAuth 登录，所以需要客户端能自定义请求头。",
        },
      ],
    },
    {
      title: "版本与变更",
      blocks: [
        {
          ul: [
            "版本写在路径里：`/api/v1`。在同一版本内只做新增：新接口、新的可选字段、新的响应字段、新的枚举值和新的事件类型。你的代码应当能接受不认识的字段和值。",
            "在 `v1` 里删除或修改任何东西都会先公告，在规范里标为弃用，并在每个响应里带上 `Deprecation` 和 `Sunset` 头：代码会发送的内容至少提前 6 个月，只会读取的字段或值至少提前 3 个月。",
            `下方接口列表所依据的 OpenAPI 3.1 规范可以[下载 JSON 文件](${developerApi.openapi})，供代码生成器和 API 工具使用。`,
          ],
        },
      ],
    },
    {
      title: "暂不提供",
      blocks: [
        {
          ul: [
            "通过 API 或 SMTP 为你的应用发信，以及针对每封新邮件的 Webhook。",
            "读取、搜索或删除邮件内容。",
            "测试密钥和沙箱：每个密钥操作的都是真实的工作区，请在可以出错的域名上试验。",
            "官方 SDK 和命令行工具。",
          ],
        },
        {
          p: `邮箱仍然通过网页邮箱、IMAP 和 SMTP 收发自己的邮件。关于 API 的问题请发邮件到 ${support}。`,
        },
      ],
    },
    {
      title: "接口列表",
      blocks: [
        {
          p: "`v1` 的全部操作，按功能分组，并标出所需的权限范围。路径相对于 API 地址；请求和响应的结构见规范。接口说明为英文。",
        },
      ],
    },
  ],
};
