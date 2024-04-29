import {ICoordenadas} from "../utiles/geopoint";

interface ECSAS {
    number?: number;
    organization?: ECSASOrganization;
}

interface ECSCodeSignature {
    digest_algorithm?: string;
    exists?: boolean;
    signing_id?: string;
    status?: string;
    subject_name?: string;
    team_id?: string;
    timestamp?: Date;
    trusted?: boolean;
    valid?: boolean;
}

interface ECSELFHeader {
    abi_version?: string;
    class?: string;
    data?: string;
    entrypoint?: number;
    object_version?: string;
    os_abi?: string;
    type?: string;
    version?: string;
}

interface ECSELFSection {
    chi2?: number;
    entropy?: number;
    flags?: string;
    name?: string;
    physical_offset?: string;
    physical_size?: number;
    type?: string;
    virtual_address?: number;
    virtual_size?: number;
}

interface ECSELFSegment {
    sections?: string[];
    type?: string;
}

interface ECSELF {
    architecture?: string;
    byte_order?: string;
    cpu_type?: string;
    creation_date?: Date;
    exports?: Record<string, string[]>;
    header?: ECSELFHeader;
    imports?: Record<string, string[]>;
    sections?: ECSELFSection[];
    segments?: ECSELFSegment[];
    shared_libraries?: string[];
    telfhash?: string;
}

interface ECSGeo {
    city_name?: string;
    continent_code?: string;
    continent_name?: string;
    country_iso_code?: string;
    country_name?: string;
    location?: ICoordenadas;
    name?: string;
    postal_code?: string;
    region_iso_code?: string;
    region_name?: string;
    timezone?: string;
}

interface ECSHash {
    md5?: string;
    sha1?: string;
    sha256?: string;
    sha384?: string;
    sha512?: string;
    ssdeep?: string;
    tlsh?: string;
}

interface ECSInterface {
    alias?: string;
    id?: string;
    name?: string;
}

type ECSOSType = "linux" | "macos" | "unix" | "windows" | "ios" | "android";

interface ECSOS {
    family?: string;
    full?: string;
    kernel?: string;
    name?: string;
    platform?: string;
    type?: ECSOSType;
    version?: string;
}

interface ECSPE {
    architecture?: string;
    company?: string;
    description?: string;
    file_version?: string;
    imphash?: string;
    original_file_name?: string;
    pehash?: string;
    product?: string;
}

interface ECSVLAN {
    id?: string;
    name?: string;
}

interface ECSX509Issuer {
    common_name?: string;
    country?: string;
    distinguished_name?: string;
    locality?: string;
    organization?: string;
    organizational_unit?: string;
    state_or_province?: string;
}

interface ECSX509Subject {
    common_name?: string;
    country?: string;
    distinguished_name?: string;
    locality?: string;
    organization?: string;
    organizational_unit?: string;
    state_or_province?: string;
}

interface ECSX509 {
    alternative_names?: string;
    issuer?: ECSX509Issuer;
    not_after?: Date;
    not_before?: Date;
    public_key_algorithm?: string;
    public_key_curve?: string;
    public_key_exponent?: number;
    public_key_size?: number;
    serial_number?: string;
    signature_algorithm?: string;
    subject?: ECSX509Subject;
    version_number?: string;
}

interface ECSAgentBuild {
    original?: string;
}

interface ECSAgent {
    build?: ECSAgentBuild;
    ephemeral_id?: string;
    id?: string;
    name?: string;
    type?: string;
    version?: string;
}

interface ECSASOrganization {
    name?: string;
}

interface ECSClientNat {
    ip?: string;
    port?: number;
}

interface ECSClient {
    address?: string;
    as?: ECSAS;
    bytes?: number;
    domain?: string;
    geo?: ECSGeo;
    ip?: string;
    mac?: string;
    nat?: ECSClientNat;
    packets?: number;
    port?: number;
    registered_domain?: string;
    subdomain?: string;
    top_level_domain?: string;
    user?: ECSUser;
}

interface ECSCloudAccount {
    id?: string;
    name?: string;
}

interface ECSCloudInstance {
    id?: string;
    name?: string;
}

interface ECSCloudMachine {
    type?: string;
}

interface ECSCloudProject {
    id?: string;
    name?: string;
}

interface ECSCloudService {
    name?: string;
}

interface ECSCloudBase {
    account?: ECSCloudAccount;
    availability_zone?: string;
    instance?: ECSCloudInstance;
    machine?: ECSCloudMachine;
    project?: ECSCloudProject;
    provider?: string;
    region?: string;
    service?: ECSCloudService;
}

interface ECSCloud extends ECSCloudBase {
    origin?: ECSCloudBase;
    target?: ECSCloudBase;
}

interface ECSContainerCPU {
    usage?: number;
}

interface ECSContainerDiskRead {
    bytes?: number;
}

interface ECSContainerDiskWrite {
    bytes?: number;
}

interface ECSContainerDisk {
    read?: ECSContainerDiskRead;
    write?: ECSContainerDiskWrite;
}

interface ECSContainerImageHash {
    all?: string[];
}

interface ECSContainerImage {
    hash?: ECSContainerImageHash;
    name?: string;
    tag?: string[];
}

interface ECSContainerMemory {
    usage?: number;
}

interface ECSContainerNetworkEgress {
    bytes?: number;
}

interface ECSContainerNetworkIngress {
    bytes?: number;
}

interface ECSContainerNetwork {
    egress?: ECSContainerNetworkEgress;
    ingress?: ECSContainerNetworkIngress;
}

interface ECSContainer {
    cpu?: ECSContainerCPU;
    disk?: ECSContainerDisk;
    id?: string;
    image?: ECSContainerImage;
    labels?: Record<string, string>;
    memory?: ECSContainerMemory;
    name?: string;
    network?: ECSContainerNetwork;
    runtime?: string;
}

type ECSDataStreamType = "logs" | "metrics";

interface ECSDataStream { // https://www.elastic.co/guide/en/ecs/8.6/ecs-data_stream.html
    dataset?: string;         // constante, máximo 100 caracteres sin -
    namespace?: string;       // constante, máximo 100 caracteres sin -
    type?: ECSDataStreamType; // constante, logs o metrics
}

interface ECSDestinationNat {
    ip?: string;
    port?: number;
}

interface ECSDestination {
    address?: string;
    as?: ECSAS;
    bytes?: number;
    domain?: string;
    geo?: ECSGeo;
    ip?: string;
    mac?: string;
    nat?: ECSDestinationNat;
    packets?: number;
    port?: number;
    registered_domain?: string;
    subdomain?: string;
    top_level_domain?: string;
    user?: ECSUser;
}

interface ECSDeviceModel {
    identifier?: string;
    name?: string;
}

interface ECSDevice {
    id?: string;
    manufacturer?: string;
    model?: ECSDeviceModel;
}

interface ECSDLL {
    code_signature?: ECSCodeSignature;
    hash?: ECSHash;
    name?: string;
    path?: string;
    pe?: ECSPE;
}

interface ECSDNSAnswer {
    class?: string;
    data?: string;
    name?: string;
    ttl?: number;
    type?: string;
}

interface ECSDNSQuestion {
    class?: string;
    name?: string;
    registered_domain?: string;
    subdomain?: string;
    top_level_domain?: string;
    type?: string;
}

type ECSDNSFlags = "AA" | "AD" | "CD" | "DO" | "RA" | "RD" | "TC";

interface ECSDNS {
    answers?: ECSDNSAnswer[];
    header_flags?: ECSDNSFlags[];
    id?: string;
    op_code?: string;
    question?: ECSDNSQuestion;
    resolved_ip?: string[];
    response_code?: string;
    type?: string;
}

interface ECSECS {
    version?: string;
}

interface ECSEmailAttachmentFile {
    extension?: string;
    hash?: ECSHash;
    mime_type?: string;
    name?: string;
    size?: number;
}

interface ECSEmailAttachment {
    file?: ECSEmailAttachmentFile;
}

interface ECSEmailBCC {
    address?: string[];
}

interface ECSEmailCC {
    address?: string[];
}

interface ECSEmailFrom {
    address?: string[];
}

interface ECSEmailReplyTo {
    address?: string[];
}

interface ECSEmailSender {
    address?: string;
}

interface ECSEmailTo {
    address?: string[];
}

interface ECSEmail {
    attachments?: ECSEmailAttachment[];
    bcc?: ECSEmailBCC;
    cc?: ECSEmailCC;
    content_type?: string;
    delivery_timestamp?: Date;
    direction?: string;
    from?: ECSEmailFrom;
    local_id?: string;
    message_id?: string;
    origination_timestamp?: Date;
    reply_to?: ECSEmailReplyTo;
    sender?: ECSEmailSender;
    subject?: string;
    to?: ECSEmailTo;
    x_mailer?: string;
}

interface ECSError {
    code?: string;
    id?: string;
    message?: string;
    stack_trace?: string;
    type?: string;
}

type ECSEventAgentIDStatus = "verified" | "mismatch" | "missing" | "auth_metadata_missing";
type ECSEventCategory = "authentication" | "configuration" | "database" | "driver" | "email" | "file" | "host" | "iam" | "intrusion_detection" | "malware" | "network" | "package" | "process" | "registry" | "session" | "threat" | "web";
type ECSEventKind = "alert" | "enrichment" | "event" | "metric" | "state" | "pipeline_error" | "signal";
type ECSEventOutcome = "failure" | "success" | "unknown";
type ECSEventType = "access" | "admin" | "allowed" | "change" | "connection" | "creation" | "deletion" | "denied" | "end" | "error" | "group" | "indicator" | "info" | "installation" | "protocol" | "start" | "user";

interface ECSEvent {
    action?: string;
    agent_id_status?: ECSEventAgentIDStatus;
    category?: ECSEventCategory[];
    code?: string;
    created?: Date;
    dataset?: string;
    duration?: number;
    end?: Date;
    hash?: string;
    id?: string;
    ingested?: Date;
    kind?: ECSEventKind;
    module?: string;
    original?: string;
    outcome?: ECSEventOutcome;
    provider?: string;
    reason?: string;
    reference?: string;
    risk_score?: number;
    risk_score_norm?: number;
    sequence?: number;
    severity?: number;
    start?: Date;
    timezone?: string;
    type?: ECSEventType[];
    url?: string;
}

type ECSFaaSTriggerType = "http" | "pubsub" | "datasource" | "timer" | "other";

interface ECSFaaSTrigger {
    request_id?: string;
    type?: ECSFaaSTriggerType;
}

interface ECSFaaS {
    coldstart?: boolean;
    execution?: string;
    id?: string;
    name?: string;
    trigger?: ECSFaaSTrigger;
    version?: string;
}

type ECSFileAttribute = "archive" | "compressed" | "directory" | "encrypted" | "execute" | "hidden" | "read" | "readonly" | "system" | "write" | string;

interface ECSFile {
    accessed?: Date;
    attributes?: ECSFileAttribute[];
    code_signature?: ECSCodeSignature;
    created?: Date;
    ctime?: Date;
    device?: string;
    directory?: string;
    drive_letter?: string;
    elf?: ECSELF;
    extension?: string;
    fork_name?: string;
    gid?: string;
    group?: string;
    hash?: ECSHash;
    inode?: string;
    mime_type?: string;
    mode?: string;
    mtime?: Date;
    name?: string;
    owner?: string;
    path?: string;
    pe?: ECSPE;
    size?: number;
    target_path?: string;
    type?: string;
    uid?: string;
    x509?: ECSX509;
}

interface ECSGroup {
    domain?: string;
    id?: string;
    name?: string;
}

interface ECSHostBoot {
    id?: string;
}

interface ECSHostCPU {
    usage?: number;
}

interface ECSHostDiskRead {
    bytes?: number;
}

interface ECSHostDiskWrite {
    bytes?: number;
}

interface ECSHostDisk {
    read?: ECSHostDiskRead;
    write?: ECSHostDiskWrite;
}

interface ECSHostNetworkEgress {
    bytes?: number;
    packets?: number;
}

interface ECSHostNetworkIngress {
    bytes?: number;
    packets?: number;
}

interface ECSHostNetwork {
    egress?: ECSHostNetworkEgress;
    ingress?: ECSHostNetworkIngress;
}

interface ECSHost {
    architecture?: string;
    boot?: ECSHostBoot;
    cpu?: ECSHostCPU;
    disk?: ECSHostDisk;
    domain?: string;
    geo?: ECSGeo;
    hostname?: string;
    id?: string;
    ip?: string[];
    mac?: string[];
    name?: string;
    network?: ECSHostNetwork;
    os?: ECSOS;
    pid_ns_ino?: string;
    type?: string;
    uptime?: number;
    risk?: ECSRisk;
}

interface ECSHTTPRequestBody {
    bytes?: number;
    content?: string;
}

interface ECSHTTPRequest {
    body?: ECSHTTPRequestBody;
    bytes?: number;
    id?: string;
    method?: string;
    mime_type?: string;
    referrer?: string;
}

interface ECSHTTPResponseBody {
    bytes?: number;
    content?: string;
}

interface ECSHTTPResponse {
    body?: ECSHTTPResponseBody;
    bytes?: number;
    mime_type?: string;
    status_code?: number;
}

interface ECSHTTP {
    request?: ECSHTTPRequest;
    response?: ECSHTTPResponse;
    version?: string;
}

interface ECSLogFile {
    path?: string;
}

interface ECSLogOriginFile {
    line?: number;
    name?: string;
}

interface ECSLogOrigin {
    file?: ECSLogOriginFile;
    function?: string;
}

interface ECSLogSyslogFacility {
    code?: number;
    name?: string;
}

interface ECSLogSyslogSeverity {
    code?: number;
    name?: string;
}

interface ECSLogSyslog {
    appname?: string;
    facility?: ECSLogSyslogFacility;
    hostname?: string;
    msgid?: string;
    priority?: number;
    procid?: string;
    severity?: ECSLogSyslogSeverity;
    structured_data?: string;
    version?: number;
}

interface ECSLog {
    file?: ECSLogFile;
    level?: string;
    logger?: string;
    origin?: ECSLogOrigin;
    syslog?: ECSLogSyslog;
}

type ECSNetworkDirection = "ingress" | "egress" | "inbound" | "outbound" | "internal" | "external" | "unknown";

interface ECSNetworkInner {
    vlan?: ECSVLAN;
}

interface ECSNetwork {
    application?: string;
    bytes?: number;
    community_id?: string;
    direction?: ECSNetworkDirection;
    forwarded_ip?: string;
    iana_number?: string;
    inner?: ECSNetworkInner;
    name?: string;
    packets?: number;
    protocol?: string;
    transport?: string;
    type?: string;
    vlan?: ECSVLAN;
}

interface ECSObserverEgress {
    interface?: ECSInterface;
    vlan?: ECSVLAN;
    zone?: string;
}

interface ECSObserverIngress {
    interface?: ECSInterface;
    vlan?: ECSVLAN;
    zone?: string;
}

interface ECSObserver {
    egress?: ECSObserverEgress;
    geo?: ECSGeo;
    hostname?: string;
    ingress?: ECSObserverIngress;
    ip?: string[];
    mac?: string[];
    name?: string;
    os?: ECSOS;
    product?: string;
    serial_number?: string;
    type?: string;
    vendor?: string;
    version?: string;
}

interface ECSOrchestratorCluster {
    id?: string;
    name?: string;
    url?: string;
    version?: string;
}

interface ECSOrchestratorResourceParent {
    type?: string;
}

interface ECSOrchestratorResource {
    id?: string;
    ip?: string[];
    name?: string;
    parent?: ECSOrchestratorResourceParent;
    type?: string;
}

interface ECSOrchestrator {
    api_version?: string;
    cluster?: ECSOrchestratorCluster;
    namespace?: string;
    organization?: string;
    resource?: ECSOrchestratorResource;
    type?: string;
}

interface ECSOrganization {
    id?: string;
    name?: string;
}

interface ECSPackage {
    architecture?: string;
    build_version?: string;
    checksum?: string;
    description?: string;
    install_scope?: string;
    installed?: Date;
    license?: string;
    name?: string;
    path?: string;
    reference?: string;
    size?: number;
    type?: string;
    version?: string;
}

interface ECSProcessEntryMeta {
    type?: string;
    source?: ECSSource;
}

interface ECSProcessIOBytesSkipped {
    length?: number;
    offset?: number;
}

interface ECSProcessIO {
    bytes_skipped?: ECSProcessIOBytesSkipped;
    max_bytes_per_process_exceeded?: boolean;
    text?: string;
    total_bytes_captured?: number;
    total_bytes_skipped?: number;
    type?: string;
}

interface ECSProcessThread {
    id?: number;
    name?: string;
}

interface ECSProcessTTYCharDevice {
    major?: number;
    minor?: number;
}

interface ECSProcessTTY {
    char_device?: ECSProcessTTYCharDevice;
    columns?: number;
    rows?: number;
}

interface ECSProcess {
    args?: string[];
    args_count?: number;
    attested_groups?: ECSGroup;
    attested_user?: ECSUser;
    code_signature?: ECSCodeSignature;
    command_line?: string;
    elf?: ECSELF;
    end?: Date;
    entity_id?: string;
    entry_leader?: ECSProcessEntryLeader;
    entry_meta?: ECSProcessEntryMeta;
    env_vars?: string[];
    executable?: string;
    exit_code?: number;
    group?: ECSGroup;
    group_leader?: ECSProcess;
    hash?: ECSHash;
    interactive?: boolean;
    io?: ECSProcessIO;
    name?: string;
    parent?: ECSProcessParent;
    pe?: ECSPE;
    pgid?: number;
    pid?: number;
    previous?: ECSProcess;
    real_group?: ECSGroup;
    real_user?: ECSUser;
    saved_group?: ECSGroup;
    saved_user?: ECSUser;
    same_as_process?: boolean;
    session_leader?: ECSProcessSessionLeader;
    start?: Date;
    supplemental_groups?: ECSGroup
    thread?: ECSProcessThread;
    title?: string;
    tty?: ECSProcessTTY;
    user?: ECSUser;
    uptime?: number;
    working_directory?: string;
}

interface ECSProcessEntryLeaderParent extends ECSProcess {
    session_leader?: ECSProcess;
}

interface ECSProcessEntryLeader extends ECSProcess {
    parent?: ECSProcessEntryLeaderParent;
}

interface ECSProcessParent extends ECSProcess {
    group_leader?: ECSProcess;
}

interface ECSProcessSessionLeaderParent extends ECSProcess {
    session_leader?: ECSProcess;
}

interface ECSProcessSessionLeader extends ECSProcess {
    parent?: ECSProcessSessionLeaderParent;
}

interface ECSRegistryData {
    bytes?: string;
    strings?: string[];
    type?: string;
}

interface ECSRegistry {
    data?: ECSRegistryData;
    hive?: string;
    key?: string;
    path?: string;
    value?: string;
}

interface ECSRelated {
    hash?: string[];
    hosts?: string[];
    ip?: string[];
    user?: string[];
}

interface ECSRisk {
    calculated_level?: string;
    calculated_score?: number;
    calculated_score_norm?: number;
    static_level?: string;
    static_score?: number;
    static_score_norm?: number;
}

interface ECSRule {
    author?: string[];
    category?: string;
    description?: string;
    id?: string;
    license?: string;
    name?: string;
    reference?: string;
    ruleset?: string;
    uuid?: string;
    version?: string;
}

interface ECSServerNat {
    ip?: string;
    port?: number;
}

interface ECSServer {
    address?: string;
    as?: ECSAS;
    bytes?: number;
    domain?: string;
    geo?: ECSGeo;
    ip?: string;
    mac?: string;
    nat?: ECSServerNat;
    packets?: number;
    port?: number;
    registered_domain?: string;
    subdomain?: string;
    top_level_domain?: string;
    user?: ECSUser;
}

interface ECSServiceNode {
    name?: string;
    role?: string;
    roles?: string[];
}

interface ECSService {
    address?: string;
    environment?: string;
    ephemeral_id?: string;
    id?: string;
    name?: string;
    node?: ECSServiceNode;
    origin?: ECSService;
    state?: string;
    target?: ECSService;
    type?: string;
    version?: string;
}

interface ECSSourceNat {
    ip?: string;
    port?: number;
}

interface ECSSource {
    address?: string;
    as?: ECSAS;
    bytes?: number;
    domain?: string;
    geo?: ECSGeo;
    ip?: string;
    mac?: string;
    nat?: ECSSourceNat;
    packets?: number;
    port?: number;
    registered_domain?: string;
    subdomain?: string;
    top_level_domain?: string;
    user?: ECSUser;
}

interface ECSThreadEnrichmentIndicatorEmail {
    address?: string;
}

type ECSThreadEnrichmentIndicatorMarkingTLP = "WHITE" | "CLEAR" | "GREEN" | "AMBER" | "AMBER+STRICT" | "RED";

interface ECSThreadEnrichmentIndicatorMarking {
    tlp?: ECSThreadEnrichmentIndicatorMarkingTLP;
    tlp_version?: string;
}

type ECSThreadEnrichmentIndicatorConfidence = "Not Specified" | "None" | "Low" | "Medium" | "High";
type ECSThreadEnrichmentIndicatorType = "autonomous-system" | "artifact" | "directory" | "domain-name" | "email-addr" | "file" | "ipv4-addr" | "ipv6-addr" | "mac-addr" | "mutex" | "port" | "process" | "software" | "url" | "user-account" | "windows-registry-key" | "x509-certificate";

interface ECSThreadEnrichmentIndicator {
    confidence?: ECSThreadEnrichmentIndicatorConfidence;
    description?: string;
    email?: ECSThreadEnrichmentIndicatorEmail;
    first_seen?: Date;
    ip?: string;
    last_seen?: Date;
    marking?: ECSThreadEnrichmentIndicatorMarking;
    modified_at?: Date;
    port?: number;
    provider?: string;
    reference?: string;
    scanner_stats?: number;
    sightings?: number;
    type?: ECSThreadEnrichmentIndicatorType;
    url?: ECSURL;
}

interface ECSThreadEnrichmentMatched {
    atomic?: string;
    field?: string;
    id?: string;
    index?: string;
    occured?: Date;
    type?: string;
}

interface ECSThreadEnrichment {
    indicator?: ECSThreadEnrichmentIndicator;
    matched?: ECSThreadEnrichmentMatched;
}

interface ECSThreadFeed {
    dashboard_id?: string;
    description?: string;
    name?: string;
    reference?: string;
}

interface ECSThreadGroup {
    alias?: string[];
    id?: string;
    name?: string;
    reference?: string;
}

interface ECSThreadIndicatorEmail {
    address?: string;
}

type ECSThreadIndicatorMarkingTLP = "WHITE" | "CLEAR" | "GREEN" | "AMBER" | "AMBER+STRICT" | "RED";

interface ECSThreadIndicatorMarking {
    tlp?: ECSThreadIndicatorMarkingTLP;
    tlp_version?: string
}

type ECSThreadIndicatorConfidence = "Not Specified" | "None" | "Low" | "Medium" | "High";
type ECSThreadIndicatorType = "autonomous-system" | "artifact" | "directory" | "domain-name" | "email-addr" | "file" | "ipv4-addr" | "ipv6-addr" | "mac-addr" | "mutex" | "port" | "process" | "software" | "url" | "user-account" | "windows-registry-key" | "x509-certificate";

interface ECSThreadIndicator {
    as?: ECSAS;
    confidence?: ECSThreadIndicatorConfidence;
    description?: string;
    email?: ECSThreadIndicatorEmail;
    file?: ECSFile;
    first_seen?: Date;
    geo?: ECSGeo;
    ip?: string;
    last_seen?: Date;
    marking?: ECSThreadIndicatorMarking;
    modified_at?: Date;
    port?: number;
    provider?: string;
    reference?: string;
    registry?: ECSRegistry;
    scanner_stats?: number;
    sightings?: number;
    type?: ECSThreadIndicatorType;
    url?: ECSURL;
    x509?: ECSX509;
}

type ECSThreadSoftwarePlatforms = "AWS" | "Azure" | "Azure AD" | "GCP" | "Linux" | "macOS" | "Network" | "Office 365" | "SaaS" | "Windows";
type ECSThreadSoftwareType = "Malware" | "Tool";

interface ECSThreadSoftware {
    alias?: string[];
    id?: string;
    name?: string;
    platforms?: ECSThreadSoftwarePlatforms[];
    reference?: string;
    type?: ECSThreadSoftwareType;
}

interface ECSThreadTactic {
    id?: string[];
    name?: string[];
    reference?: string[];
}

interface ECSThreadTechniqueSubtechnique {
    id?: string[];
    name?: string[];
    reference?: string[];
}

interface ECSThreadTechnique {
    id?: string[];
    name?: string[];
    reference?: string[];
    subtechnique?: ECSThreadTechniqueSubtechnique;
}

interface ECSThread {
    enrichments?: ECSThreadEnrichment[];
    feed?: ECSThreadFeed;
    framework?: string;
    group?: ECSThreadGroup;
    indicator?: ECSThreadIndicator;
    software?: ECSThreadSoftware;
    tactic?: ECSThreadTactic;
    technique?: ECSThreadTechnique;
}

interface ECSTLSClientHash {
    md5?: string;
    sha1?: string;
    sha256?: string;
}

interface ECSTLSClient {
    certificate?: string;
    certificate_chain?: string[];
    hash?: ECSTLSClientHash;
    issuer?: string;
    ja3?: string;
    not_after?: Date;
    not_before?: Date;
    server_name?: string;
    subject?: string;
    supported_ciphers?: string[];
    x509?: ECSX509;
}

interface ECSTLSServerHash {
    md5?: string;
    sha1?: string;
    sha256?: string;
}

interface ECSTLSServer {
    certificate?: string;
    certificate_chain?: string[];
    hash?: ECSTLSServerHash;
    issuer?: string;
    ja3s?: string;
    not_after?: Date;
    not_before?: Date;
    subject?: string;
    x509?: ECSX509;
}

interface ECSTLS {
    cipher?: string;
    client?: ECSTLSClient;
    curve?: string;
    established?: boolean;
    next_protocol?: string;
    resumed?: boolean;
    server?: ECSTLSServer;
    version?: string;
    version_protocol?: string;
}

interface ECSSpan {
    id?: string;
}

interface ECSTrace {
    id?: string;
}

interface ECSTransaction {
    id?: string;
}

interface ECSURL {
    domain?: string;
    extension?: string;
    fragment?: string;
    full?: string;
    original?: string;
    password?: string;
    path?: string;
    port?: number;
    query?: string;
    registered_domain?: string;
    scheme?: string;
    subdomain?: string;
    top_level_domain?: string;
    username?: string;
}

interface ECSUser {
    domain?: string;
    changes?: ECSUser;
    effective?: ECSUser;
    email?: string;
    full_name?: string;
    group?: ECSGroup;
    hash?: string;
    id?: string;
    name?: string;
    risk?: ECSRisk;
    roles?: string;
    target?: ECSUser;
}

interface ECSUserAgentDevice {
    name?: string;
}

interface ECSUserAgent {
    device?: ECSUserAgentDevice;
    name?: string;
    original?: string;
    os?: ECSOS;
    version?: string;
}

interface ECSVulnerabilityScanner {
    vendor?: string;
}

interface ECSVulnerabilityScore {
    base?: number;
    environmental?: number;
    temporal?: number;
    version?: string;
}

interface ECSVulnerability {
    category?: string[];
    classification?: string;
    description?: string;
    enumeration?: string;
    id?: string;
    reference?: string;
    report_id?: string;
    scanner?: ECSVulnerabilityScanner;
    score?: ECSVulnerabilityScore;
    severity?: string;
}

export interface ECS extends Record<string, any> {
    "@timestamp": Date;
    labels: Record<string, string|undefined>;
    message?: string;
    tags?: string[];
    agent?: ECSAgent;
    client?: ECSClient;
    cloud?: ECSCloud;
    container?: ECSContainer;
    data_stream?: ECSDataStream;
    destination?: ECSDestination;
    device?: ECSDevice;
    dll?: ECSDLL;
    dns?: ECSDNS;
    ecs?: ECSECS;
    email?: ECSEmail;
    error?: ECSError;
    event?: ECSEvent;
    faas?: ECSFaaS;
    file?: ECSFile;
    group?: ECSGroup;
    host?: ECSHost;
    http?: ECSHTTP;
    log?: ECSLog;
    network?: ECSNetwork;
    observer?: ECSObserver;
    orchestrator?: ECSOrchestrator;
    organization?: ECSOrganization;
    package?: ECSPackage;
    process?: ECSProcess;
    registry?: ECSRegistry;
    related?: ECSRelated;
    risk?: ECSRisk;
    rule?: ECSRule;
    server?: ECSServer;
    service?: ECSService;
    source?: ECSSource;
    threat?: ECSThread;
    tls?: ECSTLS;
    span?: ECSSpan;
    trace?: ECSTrace;
    transaction?: ECSTransaction;
    url?: ECSURL;
    user?: ECSUser;
    user_agent?: ECSUserAgent;
    vulnerability?: ECSVulnerability;
}
