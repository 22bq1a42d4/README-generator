import React, { useState, useCallback, useEffect, useRef } from 'react';
import { marked } from 'marked';
import styled, { createGlobalStyle, keyframes } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Clipboard, Download, Github, Star, GitFork, Code, Scale, Eye, ArrowLeft, Terminal } from 'lucide-react';
import * as THREE from 'https://esm.sh/three@0.164.1';

const OPENROUTER_API = "https://openrouter.ai/api/v1/chat/completions";
const GITHUB_API_BASE = "https://api.github.com/repos";

// --- Global Styles & Animations ---
const gradientAnimation = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

const spin = keyframes`from { transform: rotate(0deg); } to { transform: rotate(360deg); }`;

const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;900&display=swap');
  html {
    scroll-behavior: smooth;
  }
  body {
    margin: 0;
    background-color: #0d0c22;
    font-family: 'Inter', sans-serif;
    color: #e0e0e0;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
  }
  .markdown-preview {
    h1, h2, h3 {
      color: #fff;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      border-bottom: 1px solid #4a4a6a;
      padding-bottom: 0.3em;
      background: linear-gradient(90deg, #a78bfa, #f472b6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 0 10px rgba(167, 139, 250, 0.5);
    }
    p { line-height: 1.7; color: #c0c0c0; }
    a { color: #a78bfa; text-decoration: none; &:hover { text-decoration: underline; } }
    strong { color: #fff; }
    blockquote {
      border-left: 4px solid #a78bfa;
      background-color: rgba(167, 139, 250, 0.1);
      padding: 1em 1.5em;
      border-radius: 0 8px 8px 0;
      color: #e0e0e0;
      margin-left: 0;
    }
    code:not(pre > code) {
      background: #2c2c4a;
      padding: 0.2em 0.4em;
      border-radius: 4px;
      font-size: 0.9em;
    }
    pre {
      background: #1e1e3f;
      padding: 1em;
      border-radius: 8px;
      overflow-x: auto;
      border: 1px solid #3a3a5a;
    }
    ul, ol { padding-left: 1.5em; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1em;
      margin-bottom: 1em;
    }
    th, td {
      border: 1px solid #4a4a6a;
      padding: 0.5em 1em;
      text-align: left;
    }
    th {
      background: linear-gradient(90deg, #8b5cf6, #d946ef);
      color: white;
    }
  }
`;

const AppWrapper = styled.div`
  min-height: 100vh;
  width: 100vw;
  box-sizing: border-box;
  background: #0d0c22;
  position: relative;
  overflow-x: hidden;
`;

const AnimatedBackground = styled.div`
  position: fixed; /* Changed to fixed to stay in place during scroll */
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(-45deg, #0d0c22, #4c1d95, #2563eb, #0d0c22);
  background-size: 400% 400%;
  animation: ${gradientAnimation} 15s ease infinite;
  opacity: 0.4;
  filter: blur(100px);
  z-index: -1; /* Ensure it's behind content */
`;

const Container = styled.div`
  width: 100%;
  max-width: 72rem;
  padding: 2rem;
  margin: 0 auto;
  position: relative;
  z-index: 2;
`;

const Header = styled(motion.header)`
  text-align: center;
  margin-bottom: 3rem;
  h1 {
    font-size: 4rem;
    font-weight: 900;
    color: #fff;
    letter-spacing: -0.05em;
    background: linear-gradient(90deg, #a78bfa, #f472b6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  p { font-size: 1.25rem; color: #a0a0c0; margin-top: 0.5rem; }
`;

const InputGrid = styled(motion.div)`
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin-bottom: 2rem;
`;

const InputSection = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(30, 30, 46, 0.5);
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid #3a3a5a;
  backdrop-filter: blur(10px);
`;

const StyledInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 1.1rem;
  color: #e0e0e0;
  &::placeholder { color: #707090; }
`;

const StyledTextarea = styled.textarea`
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 1.1rem;
  color: #e0e0e0;
  resize: none;
  min-height: 60px;
  &::placeholder { color: #707090; }
`;


const GenerateButton = styled(motion.button)`
  background: linear-gradient(90deg, #8b5cf6, #d946ef);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
  &:disabled {
    background: #4a4a6a;
    box-shadow: none;
    cursor: not-allowed;
  }
`;

const Spinner = styled.div`
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: ${spin} 1s linear infinite;
`;

const ErrorMessage = styled(motion.div)`
  background: rgba(255, 100, 100, 0.1);
  border: 1px solid rgba(255, 100, 100, 0.5);
  color: #ffc0c0;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  text-align: center;
`;

const Card = styled(motion.div)`
  background: rgba(30, 30, 46, 0.5);
  backdrop-filter: blur(10px);
  border: 1px solid #3a3a5a;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const CardHeader = styled.div`
  padding: 1rem 1.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid #3a3a5a;
  h2, h3 { margin: 0; color: white; font-size: 1.2rem; }
`;

const CardBody = styled.div`
  padding: 1.5rem;
  flex-grow: 1;
  overflow-y: auto;
`;

const Placeholder = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #707090;
  text-align: center;
`;

const ActionButton = styled(motion.button)`
  flex: 1;
  padding: 0.8rem;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const PrimaryButton = styled(ActionButton)`
  background: #4a4a6a;
  color: white;
  &:hover:not(:disabled) { background: #5a5a7a; }
`;

const SecondaryButton = styled(ActionButton)`
  background: #2a9d8f;
  color: white;
  &:hover:not(:disabled) { background: #2fafa0; }
`;

const PreviewPageWrapper = styled(motion.div)`
  position: fixed; /* Changed to fixed */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #0d0c22;
  z-index: 10;
  overflow-y: auto;
`;

const PreviewHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 80rem;
  margin: 0 auto 2rem auto;
  padding: 2rem 2rem 0 2rem;
`;

const BackButton = styled(motion.button)`
  background: #2a2a4a;
  color: white;
  border: 1px solid #3a3a5a;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const StatsGrid = styled.div` display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; `;
const StatItem = styled.div` display: flex; align-items: center; gap: 0.75rem; `;

const Footer = styled.footer`
  text-align: center;
  margin-top: 3rem;
  color: #707090;
`;

// --- Landing Page Components ---
const LandingWrapper = styled(motion.div)`
    height: 100vh;
    width: 100vw;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
`;

const LandingContent = styled(motion.div)`
    text-align: center;
    position: relative;
    z-index: 2;
    h1 {
        font-size: 5rem;
        font-weight: 900;
        background: linear-gradient(90deg, #a78bfa, #f472b6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }
    p {
        font-size: 1.5rem;
        color: #a0a0c0;
        max-width: 600px;
        margin: 1rem auto 2rem auto;
    }
`;

const ThreeCanvas = styled.div`
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
`;

// --- 3D Scene Component ---
const ThreeScene = () => {
    const mountRef = useRef(null);

    useEffect(() => {
        const currentMount = mountRef.current;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        currentMount.appendChild(renderer.domElement);

        camera.position.z = 5;

        const geometry = new THREE.IcosahedronGeometry(1.5, 1);
        const material = new THREE.MeshStandardMaterial({
            color: 0xa78bfa,
            metalness: 0.5,
            roughness: 0.2,
            wireframe: true
        });
        const shape = new THREE.Mesh(geometry, material);
        scene.add(shape);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xf472b6, 1);
        pointLight.position.set(5, 5, 5);
        scene.add(pointLight);

        let animationFrameId;
        const animate = () => {
            shape.rotation.x += 0.001;
            shape.rotation.y += 0.002;
            renderer.render(scene, camera);
            animationFrameId = window.requestAnimationFrame(animate);
        };
        animate();

        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (currentMount && renderer.domElement.parentNode === currentMount) {
                currentMount.removeChild(renderer.domElement);
            }
            window.cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return <ThreeCanvas ref={mountRef} />;
};

// --- Main App Component ---
export default function App() {
  const [page, setPage] = useState('landing'); // 'landing', 'home', or 'preview'
  const [repoUrl, setRepoUrl] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [repoData, setRepoData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState("");

  const generateReadmeWithAI = async (data) => {
    const apiKey = "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";
    const model = "deepseek/deepseek-r1-0528-qwen3-8b:free";

    const prompt = `
      Generate a professional, visually appealing README.md for the GitHub repository "${data.name}".
      
      Repository Info:
      - Author: ${data.owner.login}
      - Author Profile: ${data.owner.html_url}
      - Description: ${data.description || "No description provided."}
      - Primary Language: ${data.language || "Not specified."}
      - License: ${data.license?.name || "Not specified."}

      User's Custom Instructions:
      - ${customPrompt || "No custom instructions provided."}

      **README Structure and Formatting Rules:**

      1.  **Header:** Start with a visually appealing header using a Markdown table, like this example:
          \`\`\`markdown
          <p align="center">
            <table>
              <tr>
                <td align="center"><h1><strong>${data.name}</strong></h1></td>
              </tr>
            </table>
          </p>
          <p align="center">
            ${data.description || "A brief description of the project."}
          </p>
          \`\`\`
          Do NOT use a bash terminal block for the main title.

      2.  **Sections:** Structure the README with these sections: Features, Tech Stack, Installation, Usage, Contributing, Author, and License. Use horizontal rules (\`---\`) to separate them.

      3.  **Bash for Commands:** Use bash code blocks (\`\`\`bash\`) **only** for terminal commands within the 'Installation' or 'Usage' sections.

      4.  **Author Section:** Include an 'Author' section. Create a visually appealing button linking to the author's profile using this exact markdown:
          \`\`\`markdown
          [![GitHub Profile](https://img.shields.io/badge/GitHub-Profile-blue?style=for-the-badge&logo=github)](${data.owner.html_url})
          \`\`\`

      5.  **Visual Style:** Present the content using ONE of the following modern design styles:
          * **Frosted Glass / Gradient Cards:** Use Markdown tables or code blocks to simulate cards with a clean, UI-like look. Use gradients for headers.
          * **Table-Based Dashboard:** Structure the main sections into a professional, dashboard-like table layout.
          * **Shadowed Cards with Gradient Titles:** Use headings and blockquotes to create distinct cards for each section, with prominent gradient titles.

      The output must be only valid Markdown, ready to be copied. Do not include any explanatory text before or after the Markdown content.
    `;

    try {
      const response = await fetch(OPENROUTER_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://readme-generator.ai',
          'X-Title': 'README Generator'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }]
        })
      });

      if (!response.ok) throw new Error(`AI Error: ${response.status}`);

      const result = await response.json();
      if (result.choices?.[0]?.message?.content) {
        setMarkdown(result.choices[0].message.content.trim());
      } else {
        throw new Error("Invalid AI response");
      }
    } catch (err) {
      setError(`Failed to generate README: ${err.message}`);
    }
  };

  const handleGenerateClick = async () => {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      setError("Please enter a valid GitHub repo URL.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setMarkdown("");
    setRepoData(null);

    try {
      const [, owner, repo] = match;
      const cleanRepo = repo.replace(/\.git$/, '');
      const res = await fetch(`${GITHUB_API_BASE}/${owner}/${cleanRepo}`);
      if (!res.ok) throw new Error("Repo not found or rate-limited.");
      const json = await res.json();
      setRepoData(json);
      await generateReadmeWithAI(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMarkdown = useCallback(() => {
    if (!markdown) return;
    navigator.clipboard.writeText(markdown).then(() => {
      setCopySuccess("Copied!");
      setTimeout(() => setCopySuccess(""), 2000);
    });
  }, [markdown]);

  const handleDownload = useCallback(() => {
    if (!markdown) return;
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'README.md';
    a.click();
    URL.revokeObjectURL(url);
  }, [markdown]);

  const getPreviewMarkdown = useCallback((md) => {
    if (!md) return "";
    return md.split('\n').slice(1).join('\n');
  }, []);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } }
  };

  return (
    <>
      <GlobalStyle />
      <AppWrapper>
        <AnimatedBackground />
        <AnimatePresence mode="wait">
          {page === 'landing' && (
            <LandingWrapper key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ThreeScene />
                <LandingContent initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, delay: 0.2 }}>
                    <h1>AI-Powered READMEs</h1>
                    <p>Create stunning, professional READMEs in seconds. Just provide a repository link and let our AI do the rest.</p>
                    <GenerateButton onClick={() => setPage('home')} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>Get Started</GenerateButton>
                </LandingContent>
            </LandingWrapper>
          )}

          {page === 'home' && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Container>
                <Header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
                  <h1>README Generator</h1>
                  <p>Instantly create a professional README for any GitHub repository.</p>
                </Header>

                <InputGrid initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }}>
                    <InputSection>
                      <Github size={24} color="#a0a0c0" />
                      <StyledInput
                        type="text"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/user/repo"
                      />
                    </InputSection>
                    <InputSection>
                        <Terminal size={24} color="#a0a0c0" />
                        <StyledTextarea
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            placeholder="Add details about your project (e.g., what it does, key technologies)..."
                        />
                    </InputSection>
                </InputGrid>
                
                <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }}>
                    <GenerateButton onClick={handleGenerateClick} disabled={isLoading} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }}>
                        {isLoading ? <Spinner /> : "Generate README"}
                    </GenerateButton>
                </motion.div>


                {error && <ErrorMessage initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</ErrorMessage>}
                
                <Card variants={cardVariants} initial="hidden" animate="visible" style={{ minHeight: '40vh', marginTop: '2rem' }}>
                  <CardHeader><h3>Generated Content</h3></CardHeader>
                  <CardBody>
                    {isLoading ? (
                      <Placeholder><Spinner /><p style={{marginTop: '1rem'}}>Generating README...</p></Placeholder>
                    ) : markdown ? (
                      <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: marked.parse(markdown) }} />
                    ) : (
                      <Placeholder><Share2 size={48} /><p style={{marginTop: '1rem'}}>Enter a GitHub URL and click “Generate”</p></Placeholder>
                    )}
                  </CardBody>
                </Card>

                {repoData && !isLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '2rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                      <Card>
                        <CardHeader><h3>Actions</h3></CardHeader>
                        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <PrimaryButton onClick={handleCopyMarkdown} disabled={!markdown} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Clipboard size={18} /> {copySuccess || "Copy Markdown"}
                          </PrimaryButton>
                          <SecondaryButton onClick={handleDownload} disabled={!markdown} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Download size={18} /> Download .md
                          </SecondaryButton>
                          <PrimaryButton onClick={() => setPage('preview')} disabled={!markdown} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Eye size={18} /> Full Preview
                          </PrimaryButton>
                        </CardBody>
                      </Card>
                      <Card>
                        <CardHeader><h3>Repo Stats</h3></CardHeader>
                        <CardBody>
                          <StatsGrid>
                            <StatItem><Star size={18} /> {repoData.stargazers_count.toLocaleString()} Stars</StatItem>
                            <StatItem><GitFork size={18} /> {repoData.forks_count.toLocaleString()} Forks</StatItem>
                            <StatItem><Code size={18} /> {repoData.language || "N/A"}</StatItem>
                            <StatItem><Scale size={18} /> {repoData.license?.spdx_id || "None"}</StatItem>
                          </StatsGrid>
                        </CardBody>
                      </Card>
                    </div>
                  </motion.div>
                )}
                
                <Footer>Built with React, Styled-Components, and Framer Motion</Footer>
              </Container>
            </motion.div>
          )}

          {page === 'preview' && (
            <PreviewPageWrapper key="preview" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
                <PreviewHeader>
                    <BackButton onClick={() => setPage('home')} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.05 }}>
                      <ArrowLeft size={18} /> Back
                    </BackButton>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <PrimaryButton onClick={handleCopyMarkdown} disabled={!markdown} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Clipboard size={18} /> {copySuccess || "Copy"}
                      </PrimaryButton>
                      <SecondaryButton onClick={handleDownload} disabled={!markdown} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Download size={18} /> Download
                      </SecondaryButton>
                    </div>
                </PreviewHeader>
                <div style={{
                  maxWidth: '56rem',
                  margin: '0 auto',
                  background: 'rgba(30, 30, 46, 0.5)',
                  padding: '2rem',
                  borderRadius: '16px',
                  border: '1px solid #3a3a5a'
                }}>
                  <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: marked.parse(getPreviewMarkdown(markdown)) }} />
                </div>
            </PreviewPageWrapper>
          )}
        </AnimatePresence>
      </AppWrapper>
    </>
  );
}
