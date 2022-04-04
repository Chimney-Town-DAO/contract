import { expect } from "chai";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import { ChimneyTownDAO, ChimneyTownDAO__factory } from "../types";
import {
  ERC721_INTERFACE_ID,
  ERC721_METADATA_INTERFACE_ID,
} from "./interfaceIdList";
import { MerkleTree } from "merkletreejs";
import keccak256 = require("keccak256");

describe("ChimneyTownDAO", () => {
  let owner: Signer,
    alice: Signer,
    bob: Signer,
    carol: Signer,
    dan: Signer,
    eve: Signer,
    primaryRecipient: Signer;
  let nft: ChimneyTownDAO;
  let ChimneyTown: ChimneyTownDAO__factory;

  let elements, merkleTree: MerkleTree, root: string;

  beforeEach(async () => {
    ChimneyTown = (await ethers.getContractFactory(
      "ChimneyTownDAO"
    )) as ChimneyTownDAO__factory;

    [owner, alice, bob, carol, dan, eve, primaryRecipient] =
      await ethers.getSigners();

    nft = (await ChimneyTown.deploy("https://example.com/")) as ChimneyTownDAO;

    elements = [
      await alice.getAddress(),
      await bob.getAddress(),
      await carol.getAddress(),
    ];
    merkleTree = new MerkleTree(elements, keccak256, {
      hashLeaves: true,
      sortPairs: true,
    });
    root = merkleTree.getHexRoot();
  });

  describe("constructor", () => {
    it("owner is deployer", async () => {
      expect(await nft.owner()).to.equal(await owner.getAddress());
    });
  });

  it("name", async () => {
    expect(await nft.name()).to.equal("CHIMNEY TOWN DAO");
  });

  it("symbol", async () => {
    expect(await nft.symbol()).to.equal("CTD");
  });

  describe("remainingForSale", () => {
    it("returns id", async () => {
      expect((await nft.remainingForSale()).toNumber()).to.equal(9900);
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.mint(0, { value: ethers.utils.parseEther("0.1") });
      expect((await nft.remainingForSale()).toNumber()).to.equal(9899);

      await nft.mintBatch([1, 2], { value: ethers.utils.parseEther("0.2") });
      expect((await nft.remainingForSale()).toNumber()).to.equal(9897);

      await nft.setMerkleRoot(root);
      const leaf = keccak256(await alice.getAddress());
      const proof = merkleTree.getHexProof(leaf);
      await nft.connect(alice).claim(3, proof);
      expect((await nft.remainingForSale()).toNumber()).to.equal(9896);
    });
  });

  describe("remainingReserved", () => {
    it("returns id", async () => {
      expect((await nft.remainingReserved()).toNumber()).to.equal(100);
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.mint(0, { value: ethers.utils.parseEther("0.1") });
      expect((await nft.remainingReserved()).toNumber()).to.equal(100);
      await nft.mintReserve(1, await alice.getAddress());
      expect((await nft.remainingReserved()).toNumber()).to.equal(99);
    });
  });

  describe("price", () => {
    it("returns zero if not set", async () => {
      expect(ethers.utils.formatEther(await nft.priceInWei())).to.equal("0.0");
    });

    it("returns price", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      expect(ethers.utils.formatEther(await nft.priceInWei())).to.equal("0.1");
    });

    it("can update", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.2"));
      expect(ethers.utils.formatEther(await nft.priceInWei())).to.equal("0.2");
    });
  });

  describe("isOnSale", () => {
    it("default is false", async () => {
      expect(await nft.isOnSale()).to.be.false;
    });

    it("is on sale", async () => {
      expect(await nft.isOnSale()).to.be.false;
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      expect(await nft.isOnSale()).to.be.true;
    });

    it("can stop", async () => {
      expect(await nft.isOnSale()).to.be.false;
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.setSaleStatus(false);
      expect(await nft.isOnSale()).to.be.false;
    });
  });

  describe("merkleRoot", () => {
    it("returns empty bytes if not set yet", async () => {
      expect(await nft.merkleRoot()).to.equal(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
    });

    it("returns bytes if its set", async () => {
      await nft.setMerkleRoot(merkleTree.getHexRoot());
      expect(await nft.merkleRoot()).to.equal(merkleTree.getHexRoot());
    });

    it("can update root", async () => {
      await nft.setMerkleRoot(merkleTree.getHexRoot());
      expect(await nft.merkleRoot()).to.equal(merkleTree.getHexRoot());

      const newMerkleTree = new MerkleTree(
        [await alice.getAddress(), await bob.getAddress()],
        keccak256,
        {
          hashLeaves: true,
          sortPairs: true,
        }
      );
      await nft.setMerkleRoot(newMerkleTree.getHexRoot());
      expect(await nft.merkleRoot()).to.equal(newMerkleTree.getHexRoot());
    });
  });

  describe("isClaimed", () => {
    it("returns true after claim", async () => {
      expect(await nft.isClaimed(await alice.getAddress())).to.be.false;
      await nft.setMerkleRoot(root);
      const leaf = keccak256(await alice.getAddress());
      const proof = merkleTree.getHexProof(leaf);
      await nft.connect(alice).claim(0, proof);

      expect(await nft.isClaimed(await alice.getAddress())).to.be.true;
    });

    it("returns false if minted but not claimed", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft
        .connect(alice)
        .mint(0, { value: ethers.utils.parseEther("0.1") });

      expect(await nft.isClaimed(await alice.getAddress())).to.be.false;
    });
  });

  describe("mintedSalesTokenIdList", () => {
    it("returns empty list if not minted yet", async () => {
      const list = await nft.mintedSalesTokenIdList(0, 100);
      expect(list.map((id) => id.toNumber())).to.deep.equal([]);
    });

    it("added minted list by mint(), mintBatch() and claim(), except mintReserved()", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.mint(0, { value: ethers.utils.parseEther("0.1") });
      await nft.mintBatch([1, 2], { value: ethers.utils.parseEther("0.2") });
      await nft.setMerkleRoot(root);
      const leaf = keccak256(await alice.getAddress());
      const proof = merkleTree.getHexProof(leaf);
      await nft.connect(alice).claim(3, proof);

      const list1 = await nft.mintedSalesTokenIdList(0, 100);
      expect(list1.map((id) => id.toNumber())).to.deep.equal([0, 1, 2, 3]);

      await nft.mintReserve(1, await alice.getAddress());
      const list2 = await nft.mintedSalesTokenIdList(0, 100);
      expect(list2.map((id) => id.toNumber())).to.deep.equal([0, 1, 2, 3]);
    });

    it("returns entire list limit is greater than minted list", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.mint(0, { value: ethers.utils.parseEther("0.1") });

      const list = await nft.mintedSalesTokenIdList(0, 100);
      expect(list.map((id) => id.toNumber())).to.deep.equal([0]);
    });

    it("returns limited list by offset", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);

      await nft.mintBatch(
        [...Array(100)].map((_, i) => i),
        { value: ethers.utils.parseEther("10") }
      );

      const list = await nft.mintedSalesTokenIdList(0, 10);
      expect(list.map((id) => id.toNumber())).to.deep.equal(
        [...Array(10)].map((_, index) => index + 0)
      );
    });

    it("returns skipped list by offset", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);

      await nft.mintBatch(
        [...Array(100)].map((_, i) => i),
        { value: ethers.utils.parseEther("10") }
      );

      const list = await nft.mintedSalesTokenIdList(10, 10);
      expect(list.map((id) => id.toNumber())).to.deep.equal(
        [...Array(10)].map((_, index) => index + 0 + 10)
      );
    });

    it("returns empty list if offset is greater than length", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);

      await nft.mintBatch(
        [...Array(10)].map((_, i) => i),
        { value: ethers.utils.parseEther("1") }
      );

      const list = await nft.mintedSalesTokenIdList(11, 10);
      expect(list).to.deep.equal([]);
    });

    it("returns arbitrary id list ", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);

      const idList = [
        800, 1500, 7300, 5000, 1234, 2222, 4444, 3333, 6666, 4321,
      ];

      for (let i = 0; i < idList.length; i++) {
        await nft.mint(idList[i], { value: ethers.utils.parseEther("0.1") });
      }

      const list1 = await nft.mintedSalesTokenIdList(0, 10);
      expect(list1.map((id) => id.toNumber())).to.deep.equal(idList);

      const list2 = await nft.mintedSalesTokenIdList(5, 5);
      expect(list2.map((id) => id.toNumber())).to.deep.equal(idList.slice(5));

      const list3 = await nft.mintedSalesTokenIdList(0, 5);
      expect(list3.map((id) => id.toNumber())).to.deep.equal(
        idList.slice(0, 5)
      );
    });

    it("dont revert and returns list if out of bounds happened", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);

      await nft.connect(alice).mintBatch(
        [...Array(100)].map((_, i) => i),
        { value: ethers.utils.parseEther("10") }
      );

      const list1 = await nft.mintedSalesTokenIdList(0, 101);
      expect(list1.map((id) => id.toNumber())).to.deep.equal(
        [...Array(100)].map((_, index) => index)
      );

      const list2 = await nft.mintedSalesTokenIdList(50, 101);
      expect(list2.map((id) => id.toNumber())).to.deep.equal(
        [...Array(50)].map((_, index) => index + 50)
      );
    });
  });

  describe("tokenURI", () => {
    it("return string", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.mint(0, { value: ethers.utils.parseEther("0.1") });
      expect(await nft.tokenURI(0)).to.not.equal("");
    });

    it("reverts if not minted", async () => {
      await expect(nft.tokenURI(0)).to.be.revertedWith(
        "ChimneyTownDAO: URI query for nonexistent token"
      );
    });
  });

  describe("mint", () => {
    it("success", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft
        .connect(alice)
        .mint(0, { value: ethers.utils.parseEther("0.1") });
      expect(await nft.ownerOf(0)).to.equals(await alice.getAddress());
      await nft.connect(bob).mint(1, { value: ethers.utils.parseEther("0.1") });
      expect(await nft.ownerOf(1)).to.equals(await bob.getAddress());
    });

    it("reverts if not on sale", async () => {
      await expect(nft.mint(0)).to.be.revertedWith(
        "ChimneyTownDAO: Not on sale"
      );
    });

    it("reverts if value is invalid", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await expect(
        nft.connect(alice).mint(0, { value: ethers.utils.parseEther("0.2") })
      ).to.be.revertedWith("ChimneyTownDAO: Invalid price");
      await expect(
        nft.connect(alice).mint(0, { value: ethers.utils.parseEther("0.05") })
      ).to.be.revertedWith("ChimneyTownDAO: Invalid price");
    });
  });

  describe("mintBatch", () => {
    it("success", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft
        .connect(alice)
        .mintBatch([0, 1], { value: ethers.utils.parseEther("0.2") });
      expect(
        (await nft.balanceOf(await alice.getAddress())).toNumber()
      ).to.equals(2);
      expect(await nft.ownerOf(0)).to.equals(await alice.getAddress());
      await nft
        .connect(bob)
        .mintBatch([2, 3], { value: ethers.utils.parseEther("0.2") });
      expect(
        (await nft.balanceOf(await bob.getAddress())).toNumber()
      ).to.equals(2);
      expect(await nft.ownerOf(3)).to.equals(await bob.getAddress());
    });

    it("reverts if not on sale", async () => {
      await expect(nft.mintBatch([0, 1])).to.be.revertedWith(
        "ChimneyTownDAO: Not on sale"
      );
    });

    it("reverts if value is invalid", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await expect(
        nft
          .connect(alice)
          .mintBatch([0], { value: ethers.utils.parseEther("0.3") })
      ).to.be.revertedWith("ChimneyTownDAO: Invalid price");
      await expect(
        nft
          .connect(alice)
          .mintBatch([0, 1], { value: ethers.utils.parseEther("0.1") })
      ).to.be.revertedWith("ChimneyTownDAO: Invalid price");
    });
  });

  describe("claim", () => {
    it("success", async () => {
      await nft.setMerkleRoot(root);
      const leaf = keccak256(await alice.getAddress());
      const proof = merkleTree.getHexProof(leaf);
      await nft.connect(alice).claim(0, proof);
      expect(await nft.ownerOf(0)).to.equal(await alice.getAddress());

      await nft
        .connect(bob)
        .claim(1, merkleTree.getHexProof(keccak256(await bob.getAddress())));
      expect(await nft.ownerOf(1)).to.equal(await bob.getAddress());
    });

    it("with realistic tree", async () => {
      const thousandAddressList = [...Array(1000)].map(
        (_, i) => "0x" + i.toString().padStart(40, "0")
      );
      console.log(thousandAddressList);
      const realisticMerkleTree = new MerkleTree(
        [await alice.getAddress(), ...thousandAddressList],
        keccak256,
        {
          hashLeaves: true,
          sortPairs: true,
        }
      );
      await nft.setMerkleRoot(realisticMerkleTree.getHexRoot());
      await nft
        .connect(alice)
        .claim(
          0,
          realisticMerkleTree.getHexProof(keccak256(await alice.getAddress()))
        );
      expect(await nft.ownerOf(0)).to.equal(await alice.getAddress());
    });

    it("can send ethers", async () => {
      const balance1 = await ethers.provider.getBalance(nft.address);
      await nft.setMerkleRoot(root);
      const leaf = keccak256(await alice.getAddress());
      const proof = merkleTree.getHexProof(leaf);
      await nft
        .connect(alice)
        .claim(0, proof, { value: ethers.utils.parseEther("0.1") });
      const balance2 = await ethers.provider.getBalance(nft.address);
      expect(ethers.utils.formatEther(balance2.sub(balance1))).to.equal("0.1");
    });

    it("can claim after replacing merkle root", async () => {
      await nft.setMerkleRoot(root);
      const leaf = keccak256(await alice.getAddress());
      const proof = merkleTree.getHexProof(leaf);
      await nft.connect(alice).claim(0, proof);
      expect(await nft.ownerOf(0)).to.equal(await alice.getAddress());
      await expect(
        nft
          .connect(dan)
          .claim(0, merkleTree.getHexProof(keccak256(await dan.getAddress())))
      ).to.be.revertedWith("ChimneyTownDAO: Can not verify");

      const newMerkleTree = new MerkleTree(
        [
          await dan.getAddress(),
          await carol.getAddress(),
          await eve.getAddress(),
          await alice.getAddress(),
          await bob.getAddress(),
        ],
        keccak256,
        {
          hashLeaves: true,
          sortPairs: true,
        }
      );
      await nft.setMerkleRoot(newMerkleTree.getHexRoot());
      await nft
        .connect(dan)
        .claim(1, newMerkleTree.getHexProof(keccak256(await dan.getAddress())));
    });

    it("reverts if account already claimed", async () => {
      await nft.setMerkleRoot(root);
      const leaf = keccak256(await alice.getAddress());
      const proof = merkleTree.getHexProof(leaf);
      await nft.connect(alice).claim(0, proof);
      await expect(nft.connect(alice).claim(0, proof)).to.be.revertedWith(
        "ChimneyTownDAO: Account minted token already"
      );
    });

    it("reverts if id is for reserved", async () => {
      await nft.setMerkleRoot(root);
      const leaf = keccak256(await alice.getAddress());
      const proof = merkleTree.getHexProof(leaf);
      await expect(nft.connect(alice).claim(9900, proof)).to.be.revertedWith(
        "ChimneyTownDAO: Invalid token id"
      );
      await expect(nft.connect(alice).claim(9999, proof)).to.be.revertedWith(
        "ChimneyTownDAO: Invalid token id"
      );
      await nft.connect(alice).claim(0, proof);
    });

    it("reverts if invalid proof is given", async () => {
      await nft.setMerkleRoot(root);
      const leaf = keccak256(await bob.getAddress());
      const proof = merkleTree.getHexProof(leaf);
      await expect(nft.connect(alice).claim(0, proof)).to.be.revertedWith(
        "ChimneyTownDAO: Can not verify"
      );
    });

    it("revert if merkle root is empty", async () => {
      await expect(nft.claim(0, [])).to.be.revertedWith(
        "ChimneyTownDAO: No merkle root"
      );
    });
  });

  describe("updateBaseURI", () => {
    it("update base uri", async () => {
      await nft.setMerkleRoot(root);
      const leaf = keccak256(await alice.getAddress());
      const proof = merkleTree.getHexProof(leaf);
      await nft.connect(alice).claim(0, proof);
      expect(await nft.tokenURI(0)).to.equal("https://example.com/0.json");
      await nft.updateBaseURI("https://example.com/updated/");
      expect(await nft.tokenURI(0)).to.equal(
        "https://example.com/updated/0.json"
      );
    });

    it("reverts if metadata is frozen", async () => {
      await nft.freezeMetadata();
      await expect(nft.updateBaseURI("should be reverted")).to.be.revertedWith(
        "ChimneyTownDAO: Metadata is frozen"
      );
    });
  });

  describe("mintReserve", () => {
    it("mint reserved token", async () => {
      await nft.mintReserve(10, await alice.getAddress());
      expect(
        (await nft.balanceOf(await alice.getAddress())).toNumber()
      ).to.equal(10);
    });

    it("can mint up to 100", async () => {
      await nft.mintReserve(100, await alice.getAddress());
      expect(
        (await nft.balanceOf(await alice.getAddress())).toNumber()
      ).to.equal(100);
      await expect(nft.mintReserve(1, await alice.getAddress())).to.be.reverted;
    });

    it("only owner", async () => {
      await expect(
        nft.connect(alice).mintReserve(1, await alice.getAddress())
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("setSaleStatus", () => {
    it("reverts if price is zero", async () => {
      await expect(nft.setSaleStatus(true)).to.be.revertedWith(
        "ChimneyTownDAO: Price is not set yet"
      );
    });
  });

  describe("withdraw", () => {
    it("send value to recipient", async () => {
      const balance1 = await primaryRecipient.getBalance();
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.mint(0, { value: ethers.utils.parseEther("0.1") });
      await nft.withdraw(
        await primaryRecipient.getAddress(),
        await ethers.provider.getBalance(nft.address)
      );

      const balance2 = await primaryRecipient.getBalance();
      expect(ethers.utils.formatEther(balance2.sub(balance1))).to.equal("0.1");
    });

    it("recipient is dynamic", async () => {
      const balance1 = await alice.getBalance();
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.mint(0, { value: ethers.utils.parseEther("0.1") });
      await nft.withdraw(
        await alice.getAddress(),
        await ethers.provider.getBalance(nft.address)
      );

      const balance2 = await alice.getBalance();
      expect(ethers.utils.formatEther(balance2.sub(balance1))).to.equal("0.1");
    });

    it("amount to withdraw is dynamic", async () => {
      const balance1 = await alice.getBalance();
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.mint(0, { value: ethers.utils.parseEther("0.1") });
      await nft.withdraw(
        await alice.getAddress(),
        ethers.utils.parseEther("0.05")
      );

      const balance2 = await alice.getBalance();
      expect(ethers.utils.formatEther(balance2.sub(balance1))).to.equal("0.05");
    });

    it("reverts if specified amount is greater than balance", async () => {
      await expect(
        nft.withdraw(await alice.getAddress(), ethers.utils.parseEther("0.1"))
      ).to.be.revertedWith("Address: insufficient balance");
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.mint(0, { value: ethers.utils.parseEther("0.1") });
      await expect(
        nft.withdraw(await alice.getAddress(), ethers.utils.parseEther("0.2"))
      ).to.be.revertedWith("Address: insufficient balance");

      await nft.withdraw(
        await alice.getAddress(),
        ethers.utils.parseEther("0.1")
      );
    });
  });

  it("can receive ETH", async () => {
    await owner.sendTransaction({
      to: nft.address,
      value: ethers.utils.parseEther("0.1"),
    });
    expect(
      ethers.utils.formatEther(await ethers.provider.getBalance(nft.address))
    ).to.equal("0.1");
  });

  describe("supportsInterface", () => {
    it("supports ERC721 interface", async () => {
      expect(await nft.supportsInterface(ERC721_INTERFACE_ID)).to.be.true;
    });

    it("supports ERC721Metadata interface", async () => {
      expect(await nft.supportsInterface(ERC721_METADATA_INTERFACE_ID)).to.be
        .true;
    });
  });

  // TODO activate to test
  xit("sold out", async () => {
    await nft.setPrice(ethers.utils.parseEther("0.01"));
    await nft.setSaleStatus(true);

    for (let i = 0; i < 9900; i++) {
      if (i % 100 == 0) {
        console.log("i: ", i);
      }
      await nft
        .connect(alice)
        .mint(i, { value: ethers.utils.parseEther("0.01") });
    }

    await expect(
      nft.connect(alice).mint(0, { value: ethers.utils.parseEther("0.01") })
    ).to.be.reverted;
    await expect(
      nft.connect(alice).mintBatch(
        [...Array(100)].map((_, i) => i),
        { value: ethers.utils.parseEther("1") }
      )
    ).to.be.reverted;
    await nft.setMerkleRoot(root);
    const leaf = keccak256(await alice.getAddress());
    const proof = merkleTree.getHexProof(leaf);
    await expect(nft.connect(alice).claim(0, proof)).to.be.reverted;
    await nft.mintReserve(100, await alice.getAddress());
    await expect(nft.mintReserve(1, await alice.getAddress())).to.be.reverted;
  });
});
